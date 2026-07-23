"""Deterministic mock provider — the review-pipeline analogue of Shipyard's
``DEPLOY_DRIVER=mock``: exercises the entire pipeline (diff fetch → analysis →
comment rendering → posting) with no LLM dependency, in tests and local dev.

It performs a handful of honest textual checks so demo findings look real and
are stable for a given diff.
"""

from __future__ import annotations

import re

from ..models import FileDiff

_PATTERNS: list[tuple[re.Pattern[str], str, str, str]] = [
    (
        # An assignment of a string LITERAL to a credential-ish name — not any
        # mention of "secret" (type annotations and identifiers are fine).
        re.compile(
            r"(password|secret|api[_-]?key|token)\w*\s*[:=]\s*[\"'][^\"']{4,}[\"']",
            re.IGNORECASE,
        ),
        "security",
        "high",
        "Possible hardcoded credential in changed code",
    ),
    (
        re.compile(r"\beval\(|child_process|exec\(", re.IGNORECASE),
        "security",
        "high",
        "Dynamic code/command execution in changed code",
    ),
    (
        re.compile(r"TODO|FIXME|HACK"),
        "style",
        "low",
        "Unresolved TODO/FIXME marker added",
    ),
    (
        re.compile(r"console\.log|print\("),
        "style",
        "low",
        "Debug output statement added",
    ),
    (
        re.compile(r"catch\s*(\(\s*\w*\s*\))?\s*\{\s*\}"),
        "bug",
        "medium",
        "Empty catch block swallows errors",
    ),
]


class MockProvider:
    """Static-analysis-flavored mock; deterministic for a given diff."""

    name = "mock"

    def review(self, repo: str, pr_number: int, files: list[FileDiff]) -> list[dict]:
        findings: list[dict] = []
        for file in files:
            line_number = 0
            for raw_line in file.patch.splitlines():
                # Track new-file line numbers from @@ hunk headers.
                hunk = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)", raw_line)
                if hunk:
                    line_number = int(hunk.group(1)) - 1
                    continue
                if raw_line.startswith("-"):
                    continue
                if raw_line.startswith("+") and not raw_line.startswith("+++"):
                    line_number += 1
                    content = raw_line[1:]
                    for pattern, category, severity, title in _PATTERNS:
                        if pattern.search(content):
                            findings.append(
                                {
                                    "file": file.path,
                                    "line": line_number,
                                    "severity": severity,
                                    "category": category,
                                    "title": title,
                                    "detail": f"`{content.strip()[:120]}`",
                                    "suggestion": None,
                                }
                            )
                elif not raw_line.startswith(("---", "+++", "diff ", "index ")):
                    line_number += 1
        return findings
