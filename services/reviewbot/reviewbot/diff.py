"""Fetching and preparing PR diffs for review.

The diff comes from GitHub's pull-request endpoint in unified-diff form —
authenticated via a GitHub App installation token when the project has one,
or unauthenticated for public repos. Before the LLM sees it, the diff is
split per file, generated/vendored noise is dropped, and both per-file and
total budgets are enforced so a giant PR cannot blow the context (or the
bill).
"""

from __future__ import annotations

import fnmatch
import re

import httpx

from .models import FileDiff

#: Files that add noise, not signal, to a code review.
IGNORED_PATTERNS = (
    "*.lock",
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "go.sum",
    "*.min.js",
    "*.min.css",
    "*.map",
    "*.snap",
    "dist/*",
    "*/dist/*",
    "node_modules/*",
    "*/node_modules/*",
    "*.png",
    "*.jpg",
    "*.gif",
    "*.ico",
    "*.pdf",
    "*.woff*",
)

#: Per-file patch budget (bytes) — a single sprawling file can't eat the whole prompt.
MAX_FILE_PATCH_BYTES = 30_000

_DIFF_HEADER = re.compile(r"^diff --git a/(?P<a>.+?) b/(?P<b>.+)$", re.MULTILINE)


class DiffUnavailableError(RuntimeError):
    """The PR diff could not be fetched."""


def fetch_diff(
    repo_full_name: str,
    pr_number: int,
    token: str | None,
    timeout: float = 30.0,
) -> str:
    """Fetch a PR's unified diff from GitHub.

    ``token`` is a GitHub App installation token (private repos) or ``None``
    for anonymous access (public repos; subject to GitHub's rate limits).
    """
    headers = {
        "Accept": "application/vnd.github.v3.diff",
        "User-Agent": "shipyard-reviewbot",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"https://api.github.com/repos/{repo_full_name}/pulls/{pr_number}"
    try:
        response = httpx.get(url, headers=headers, timeout=timeout, follow_redirects=True)
    except httpx.HTTPError as error:
        raise DiffUnavailableError(f"diff fetch failed: {error}") from error
    if response.status_code != 200:
        raise DiffUnavailableError(
            f"diff fetch returned HTTP {response.status_code} for {repo_full_name}#{pr_number}"
        )
    return response.text


def is_ignored(path: str) -> bool:
    """Whether a path is review noise (lockfiles, minified/binary assets…)."""
    return any(fnmatch.fnmatch(path, pattern) for pattern in IGNORED_PATTERNS)


def split_diff(diff_text: str) -> list[FileDiff]:
    """Split a unified diff into per-file patches, dropping ignored files."""
    matches = list(_DIFF_HEADER.finditer(diff_text))
    files: list[FileDiff] = []
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(diff_text)
        # The `b/` side is the post-change path (handles renames).
        path = match.group("b").strip()
        if is_ignored(path):
            continue
        patch = diff_text[start:end]
        truncated = False
        if len(patch.encode("utf-8", errors="replace")) > MAX_FILE_PATCH_BYTES:
            patch = patch[:MAX_FILE_PATCH_BYTES] + "\n… [patch truncated by reviewbot]\n"
            truncated = True
        files.append(FileDiff(path=path, patch=patch, truncated=truncated))
    return files


def apply_total_budget(files: list[FileDiff], max_total_bytes: int) -> tuple[list[FileDiff], int]:
    """Keep files (in order) until the total budget is spent.

    Returns the kept files and how many were dropped.
    """
    kept: list[FileDiff] = []
    spent = 0
    for file in files:
        size = len(file.patch.encode("utf-8", errors="replace"))
        if spent + size > max_total_bytes and kept:
            break
        kept.append(file)
        spent += size
    return kept, len(files) - len(kept)
