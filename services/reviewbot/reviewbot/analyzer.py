"""The review pipeline: prepared diff → provider → validated findings.

Providers return *raw* dicts (LLM output is untrusted); this module owns the
hardening: schema coercion, dropping findings that reference files not in the
diff (hallucinations), dedupe, severity ordering, and the findings cap.
"""

from __future__ import annotations

import logging

from .config import Config
from .diff import apply_total_budget, split_diff
from .models import Finding, ReviewJob, ReviewResult
from .providers import Provider

logger = logging.getLogger(__name__)


def analyze(
    job: ReviewJob,
    diff_text: str,
    provider: Provider,
    config: Config,
) -> ReviewResult:
    """Run one review over a fetched diff and return the normalized result."""
    files = split_diff(diff_text)
    if not files:
        return ReviewResult(
            job=job,
            provider=provider.name,
            skipped_reason="diff contains no reviewable files",
        )

    files, dropped = apply_total_budget(files, config.max_diff_bytes)
    if dropped:
        logger.info(
            "diff over budget for %s#%s: reviewing %d files, dropped %d",
            job.repo_full_name,
            job.pr_number,
            len(files),
            dropped,
        )

    raw_findings = provider.review(job.repo_full_name, job.pr_number, files)

    changed_paths = {file.path for file in files}
    findings: list[Finding] = []
    seen: set[tuple[str, int | None, str]] = set()
    hallucinated = 0
    for raw in raw_findings:
        finding = Finding.from_raw(raw)
        if finding is None:
            continue
        if finding.file not in changed_paths:
            hallucinated += 1
            continue
        key = (finding.file, finding.line, finding.title.lower())
        if key in seen:
            continue
        seen.add(key)
        findings.append(finding)

    if hallucinated:
        logger.info(
            "dropped %d finding(s) referencing files outside the diff for %s#%s",
            hallucinated,
            job.repo_full_name,
            job.pr_number,
        )

    findings.sort(key=Finding.sort_key)
    if len(findings) > config.max_findings:
        findings = findings[: config.max_findings]

    return ReviewResult(
        job=job,
        findings=findings,
        files_reviewed=len(files),
        provider=provider.name,
    )
