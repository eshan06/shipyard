"""Render a ReviewResult as the PR comment body (GitHub-flavored markdown)."""

from __future__ import annotations

from .models import ReviewResult

#: A stable marker so re-reviews of the same PR are recognizable (and a future
#: enhancement could update-in-place instead of stacking comments).
MARKER = "<!-- shipyard-reviewbot -->"

_SEVERITY_BADGE = {
    "critical": "🟥 critical",
    "high": "🟧 high",
    "medium": "🟨 medium",
    "low": "🟦 low",
    "style": "⬜ style",
}


def render_comment(result: ReviewResult) -> str:
    """Build the markdown body posted back to the pull request."""
    job = result.job
    head = job.head_sha[:10]
    lines = [
        MARKER,
        f"## ⚓ Shipyard review — `{head}`",
        "",
    ]

    if result.skipped_reason:
        lines.append(f"_Review skipped: {result.skipped_reason}._")
        return "\n".join(lines)

    if not result.findings:
        lines.append(
            f"No issues found across {result.files_reviewed} changed file(s). "
            "This is an automated review — it does not replace a human one."
        )
    else:
        lines.append(
            f"**{len(result.findings)} finding(s)** across {result.files_reviewed} "
            "changed file(s). Automated review — verify before acting."
        )
        lines.append("")
        for finding in result.findings:
            location = f"`{finding.file}`" + (f" line {finding.line}" if finding.line else "")
            lines.append(
                f"- **[{_SEVERITY_BADGE[finding.severity]}] {finding.title}** — "
                f"{location} · _{finding.category}_"
            )
            lines.append(f"  {finding.detail}")
            if finding.suggestion:
                lines.append(f"  **Suggestion:** {finding.suggestion}")
        lines.append("")

    lines.append("")
    lines.append(f"<sub>provider: {result.provider} · head: `{job.head_sha}`</sub>")
    return "\n".join(lines)
