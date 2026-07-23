"""The BullMQ worker: consume `review` jobs enqueued by the Shipyard API.

The queue name and payload shape are the cross-language contract with
``packages/core/src/jobs.ts`` (``QUEUE.review`` / ``ReviewJobSchema``). The
API deduplicates per (PR, head sha); this worker is idempotent per job and
treats reviews as strictly advisory — no failure here should ever affect the
deploy pipeline.
"""

from __future__ import annotations

import asyncio
import json
import logging
import signal
import sys

from bullmq import Worker

from .analyzer import analyze
from .comment import render_comment
from .config import Config, load_config
from .diff import DiffUnavailableError, fetch_diff
from .github import GitHubApp
from .models import InvalidJobError, ReviewJob, ReviewResult
from .providers import Provider, ProviderError, get_provider

logger = logging.getLogger("reviewbot")

#: BullMQ queue name — QUEUE.review in @shipyard/core.
QUEUE_NAME = "review"


def _read_fixture(path: str) -> str:
    """Read a fixture diff, surfacing failures as the standard skip reason."""
    try:
        with open(path, encoding="utf-8") as handle:
            return handle.read()
    except OSError as error:
        raise DiffUnavailableError(f"fixture diff unreadable: {error}") from error


def result_summary(result: ReviewResult) -> dict[str, object]:
    """JSON-safe job result stored by BullMQ (visible in queue tooling)."""
    return {
        "pr": f"{result.job.repo_full_name}#{result.job.pr_number}",
        "headSha": result.job.head_sha,
        "provider": result.provider,
        "filesReviewed": result.files_reviewed,
        "findings": len(result.findings),
        "skipped": result.skipped_reason,
    }


def process_review(
    payload: object,
    provider: Provider,
    config: Config,
    github: GitHubApp | None,
) -> ReviewResult:
    """Handle one review job synchronously (testable core, no BullMQ)."""
    job = ReviewJob.from_payload(payload)

    token: str | None = None
    if github is not None and job.installation_id:
        try:
            token = github.installation_token(job.installation_id)
        except Exception as error:  # noqa: BLE001 — fall back to anonymous fetch
            logger.warning("installation token failed (%s); trying anonymous diff fetch", error)

    try:
        if config.diff_fixture is not None:
            # Offline/demo mode: review a fixture diff instead of calling
            # GitHub (the seeded demo repos don't exist there). Exercises the
            # exact same pipeline downstream of the fetch.
            logger.info("using fixture diff %s (REVIEWBOT_DIFF_FIXTURE)", config.diff_fixture)
            diff_text = _read_fixture(config.diff_fixture)
        else:
            diff_text = fetch_diff(job.repo_full_name, job.pr_number, token)
    except DiffUnavailableError as error:
        # Nothing to review (private repo without App creds, deleted PR, rate
        # limit). The review is advisory: record why and finish successfully —
        # retrying won't help until configuration changes.
        logger.warning("skipping review for %s#%s: %s", job.repo_full_name, job.pr_number, error)
        return ReviewResult(job=job, provider=provider.name, skipped_reason=str(error))

    result = analyze(job, diff_text, provider, config)

    # Structured findings record — the machine-readable output stream.
    logger.info(
        "review complete %s",
        json.dumps(
            {
                "event": "review.complete",
                "repo": job.repo_full_name,
                "pr": job.pr_number,
                "headSha": job.head_sha,
                "provider": result.provider,
                "filesReviewed": result.files_reviewed,
                "findings": [vars(finding) for finding in result.findings],
                "skipped": result.skipped_reason,
            }
        ),
    )

    if github is not None and job.installation_id and result.skipped_reason is None:
        posted = github.post_pr_comment(
            job.repo_full_name, job.pr_number, job.installation_id, render_comment(result)
        )
        logger.info("PR comment %s for %s#%s", "posted" if posted else "NOT posted", job.repo_full_name, job.pr_number)
    else:
        logger.info(
            "PR comment skipped for %s#%s (no GitHub App credentials/installation)",
            job.repo_full_name,
            job.pr_number,
        )

    return result


async def run() -> None:
    """Start the worker and block until SIGINT/SIGTERM."""
    config = load_config()
    logging.basicConfig(
        level=config.log_level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        stream=sys.stdout,
    )
    provider = get_provider(config)
    github = GitHubApp.from_config(config.github_app_id, config.github_app_private_key)

    logger.info(
        "starting shipyard reviewbot (queue=%s provider=%s github_app=%s concurrency=%d)",
        QUEUE_NAME,
        provider.name,
        "on" if github else "off",
        config.concurrency,
    )

    async def processor(job, job_token):  # noqa: ANN001 — bullmq's signature
        try:
            # Providers are sync (httpx/SDK); run off the event loop so long
            # LLM calls don't stall queue heartbeats.
            result = await asyncio.to_thread(
                process_review, job.data, provider, config, github
            )
            # BullMQ stores the processor's return value as the job's result —
            # it MUST be JSON-serializable. Returning the ReviewResult dataclass
            # here made result storage throw AFTER the review's side effects
            # ran, so every job "failed" and retried (3× analysis + comments).
            return result_summary(result)
        except InvalidJobError as error:
            # A malformed payload will never succeed — log and swallow so
            # BullMQ doesn't retry it forever.
            logger.error("dropping invalid review job %s: %s", job.id, error)
            return None
        except ProviderError:
            raise  # transient — let BullMQ retry per the job's attempts
        except Exception:
            logger.exception("review job %s failed", job.id)
            raise

    worker = Worker(
        QUEUE_NAME,
        processor,
        {"connection": config.redis_url, "concurrency": config.concurrency},
    )

    stop = asyncio.Event()

    def request_stop(*_args: object) -> None:
        logger.info("shutdown requested")
        stop.set()

    for signal_name in ("SIGINT", "SIGTERM"):
        if hasattr(signal, signal_name):
            try:
                asyncio.get_running_loop().add_signal_handler(
                    getattr(signal, signal_name), request_stop
                )
            except NotImplementedError:
                # Windows event loop: fall back to KeyboardInterrupt handling.
                signal.signal(getattr(signal, signal_name), request_stop)

    try:
        await stop.wait()
    except KeyboardInterrupt:
        pass
    finally:
        logger.info("closing worker…")
        await worker.close()
        logger.info("reviewbot stopped")
