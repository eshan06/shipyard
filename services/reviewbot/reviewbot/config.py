"""Environment configuration for the reviewbot worker.

Mirrors the style of the TypeScript apps' ``loadConfig``: read everything from
the environment once at startup, apply defaults, treat blank values as unset,
and fail fast with a message naming every missing/invalid field.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

#: Providers the REVIEWBOT_LLM env var may select.
PROVIDERS = ("mock", "anthropic", "ollama")


@dataclass(frozen=True)
class Config:
    """Validated reviewbot configuration (immutable)."""

    redis_url: str
    #: Which LLM backend performs the analysis: mock | anthropic | ollama.
    llm: str
    #: Model override for the Anthropic provider.
    anthropic_model: str
    #: Base URL of a local Ollama server (ollama provider only).
    ollama_url: str
    #: Model name to request from Ollama.
    ollama_model: str
    #: GitHub App credentials — enable private-repo diffs + PR comments.
    github_app_id: str | None
    github_app_private_key: str | None
    #: Path to a unified-diff file used INSTEAD of fetching from GitHub.
    #: The review-pipeline analogue of DEPLOY_DRIVER=mock's fabricated
    #: preview URLs: lets local dev/demos exercise the full pipeline offline
    #: (the seeded demo repos don't exist on real GitHub). Leave unset in
    #: any deployed environment.
    diff_fixture: str | None
    #: Hard cap on the diff text sent to the LLM (bytes, post-filtering).
    max_diff_bytes: int
    #: Cap on findings reported per review.
    max_findings: int
    #: BullMQ concurrency for the review queue.
    concurrency: int
    log_level: str


def _env(name: str, default: str | None = None) -> str | None:
    """Read an env var, treating blank/whitespace values as unset."""
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    return value.strip()


def _int(name: str, default: int, minimum: int, errors: list[str]) -> int:
    raw = _env(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        errors.append(f"  - {name}: must be an integer (got {raw!r})")
        return default
    if value < minimum:
        errors.append(f"  - {name}: must be >= {minimum}")
    return value


def load_config() -> Config:
    """Build a :class:`Config` from the environment or raise ``ValueError``."""
    errors: list[str] = []

    redis_url = _env("REDIS_URL")
    if redis_url is None:
        errors.append("  - REDIS_URL: required (e.g. redis://127.0.0.1:6379)")

    llm = (_env("REVIEWBOT_LLM", "mock") or "mock").lower()
    if llm not in PROVIDERS:
        errors.append(f"  - REVIEWBOT_LLM: must be one of {', '.join(PROVIDERS)}")

    # The GitHub App key may arrive with literal \n escapes (compose/k8s env);
    # normalize the same way the TS worker does.
    private_key = _env("GITHUB_APP_PRIVATE_KEY")
    if private_key is not None:
        private_key = private_key.replace("\\n", "\n")

    config = Config(
        redis_url=redis_url or "",
        llm=llm,
        anthropic_model=_env("REVIEWBOT_ANTHROPIC_MODEL", "claude-opus-4-8") or "",
        ollama_url=_env("OLLAMA_URL", "http://localhost:11434") or "",
        ollama_model=_env("REVIEWBOT_OLLAMA_MODEL", "llama3.1") or "",
        github_app_id=_env("GITHUB_APP_ID"),
        github_app_private_key=private_key,
        diff_fixture=_env("REVIEWBOT_DIFF_FIXTURE"),
        max_diff_bytes=_int("REVIEWBOT_MAX_DIFF_BYTES", 200_000, 1_000, errors),
        max_findings=_int("REVIEWBOT_MAX_FINDINGS", 15, 1, errors),
        concurrency=_int("REVIEWBOT_CONCURRENCY", 2, 1, errors),
        log_level=(_env("LOG_LEVEL", "INFO") or "INFO").upper(),
    )

    if errors:
        raise ValueError(
            "Invalid reviewbot configuration. Fix the following environment variables:\n"
            + "\n".join(errors)
        )
    return config
