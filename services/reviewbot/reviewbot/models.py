"""Data models for the review pipeline.

``ReviewJob`` mirrors the queue payload's cross-language contract defined by
``ReviewJobSchema`` in ``packages/core/src/jobs.ts`` — keep the two in sync
(additive changes only). ``Finding`` is the normalized unit of review output
every provider must produce.
"""

from __future__ import annotations

from dataclasses import dataclass, field

#: Ranked severities (most severe first) — also the report sort order.
SEVERITIES = ("critical", "high", "medium", "low", "style")
#: Finding categories the prompt asks for.
CATEGORIES = ("bug", "security", "performance", "style")


class InvalidJobError(ValueError):
    """The queue payload does not match the ReviewJob contract."""


@dataclass(frozen=True)
class ReviewJob:
    """A validated `review` queue payload (see ReviewJobSchema in @shipyard/core)."""

    pull_request_id: str
    project_id: str
    repo_full_name: str
    pr_number: int
    head_sha: str
    installation_id: str | None

    @classmethod
    def from_payload(cls, payload: object) -> "ReviewJob":
        """Validate a raw queue payload into a :class:`ReviewJob`."""
        if not isinstance(payload, dict):
            raise InvalidJobError(f"payload must be an object, got {type(payload).__name__}")

        def require_str(key: str) -> str:
            value = payload.get(key)
            if not isinstance(value, str) or not value:
                raise InvalidJobError(f"{key}: required non-empty string")
            return value

        pr_number = payload.get("prNumber")
        if not isinstance(pr_number, int) or isinstance(pr_number, bool) or pr_number <= 0:
            raise InvalidJobError("prNumber: required positive integer")

        installation_id = payload.get("installationId")
        if installation_id is not None and not isinstance(installation_id, str):
            raise InvalidJobError("installationId: must be a string or null")

        repo = require_str("repoFullName")
        if "/" not in repo:
            raise InvalidJobError("repoFullName: expected owner/name form")

        return cls(
            pull_request_id=require_str("pullRequestId"),
            project_id=require_str("projectId"),
            repo_full_name=repo,
            pr_number=pr_number,
            head_sha=require_str("headSha"),
            installation_id=installation_id,
        )


@dataclass
class Finding:
    """One review finding, normalized across providers."""

    file: str
    title: str
    detail: str
    severity: str = "medium"
    category: str = "bug"
    line: int | None = None
    suggestion: str | None = None

    @classmethod
    def from_raw(cls, raw: object) -> "Finding | None":
        """Coerce one raw (LLM-produced) finding; return None if unusable."""
        if not isinstance(raw, dict):
            return None
        file = raw.get("file")
        title = raw.get("title")
        detail = raw.get("detail")
        if not (isinstance(file, str) and file and isinstance(title, str) and title):
            return None
        if not isinstance(detail, str) or not detail:
            detail = title

        severity = str(raw.get("severity", "medium")).lower()
        if severity not in SEVERITIES:
            severity = "medium"
        category = str(raw.get("category", "bug")).lower()
        if category not in CATEGORIES:
            category = "bug"

        line = raw.get("line")
        if isinstance(line, bool) or not isinstance(line, int) or line <= 0:
            line = None

        suggestion = raw.get("suggestion")
        if not isinstance(suggestion, str) or not suggestion.strip():
            suggestion = None

        # Normalize path form so dedupe + changed-file matching behave.
        file = file.replace("\\", "/").lstrip("./")

        return cls(
            file=file,
            title=title.strip()[:200],
            detail=detail.strip()[:2_000],
            severity=severity,
            category=category,
            line=line,
            suggestion=suggestion,
        )

    def sort_key(self) -> tuple[int, str, int]:
        return (SEVERITIES.index(self.severity), self.file, self.line or 0)


@dataclass
class FileDiff:
    """One file's patch extracted from a unified diff."""

    path: str
    patch: str
    truncated: bool = False


@dataclass
class ReviewResult:
    """The outcome of one review run (what the worker logs / posts)."""

    job: ReviewJob
    findings: list[Finding] = field(default_factory=list)
    files_reviewed: int = 0
    skipped_reason: str | None = None
    provider: str = "mock"
