"""Unit tests for the review pipeline (models, diff prep, analyzer, comment)."""

from __future__ import annotations

import pytest

from reviewbot.analyzer import analyze
from reviewbot.comment import MARKER, render_comment
from reviewbot.config import Config
from reviewbot.diff import apply_total_budget, is_ignored, split_diff
from reviewbot.models import FileDiff, Finding, InvalidJobError, ReviewJob
from reviewbot.providers.mock import MockProvider

SAMPLE_DIFF = """\
diff --git a/src/auth.ts b/src/auth.ts
index 111..222 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,4 +10,6 @@ function login() {
 context
+const password = "hunter2";
+try { risky(); } catch {}
 more context
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 333..444 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -1,2 +1,2 @@
-old
+new
diff --git a/README.md b/README.md
index 555..666 100644
--- a/README.md
+++ b/README.md
@@ -1,1 +1,2 @@
 # readme
+TODO: write docs
"""


def make_config(**overrides) -> Config:
    defaults = dict(
        redis_url="redis://x",
        llm="mock",
        anthropic_model="claude-opus-4-8",
        ollama_url="http://localhost:11434",
        ollama_model="llama3.1",
        github_app_id=None,
        github_app_private_key=None,
        diff_fixture=None,
        max_diff_bytes=200_000,
        max_findings=15,
        concurrency=1,
        log_level="INFO",
    )
    defaults.update(overrides)
    return Config(**defaults)


def make_job(**overrides) -> ReviewJob:
    payload = dict(
        pullRequestId="pr_1",
        projectId="proj_1",
        repoFullName="acme/storefront",
        prNumber=412,
        headSha="a1b2c3d4e5f6",
        installationId=None,
    )
    payload.update(overrides)
    return ReviewJob.from_payload(payload)


class TestReviewJob:
    def test_valid_payload_parses(self):
        job = make_job()
        assert job.repo_full_name == "acme/storefront"
        assert job.pr_number == 412
        assert job.installation_id is None

    @pytest.mark.parametrize(
        "mutation",
        [
            {"prNumber": 0},
            {"prNumber": "412"},
            {"repoFullName": ""},
            {"repoFullName": "no-slash"},
            {"headSha": None},
            {"installationId": 5},
        ],
    )
    def test_invalid_payloads_rejected(self, mutation):
        payload = dict(
            pullRequestId="pr_1",
            projectId="proj_1",
            repoFullName="acme/storefront",
            prNumber=412,
            headSha="abc",
            installationId=None,
        )
        payload.update(mutation)
        with pytest.raises(InvalidJobError):
            ReviewJob.from_payload(payload)

    def test_non_dict_payload_rejected(self):
        with pytest.raises(InvalidJobError):
            ReviewJob.from_payload(["not", "a", "dict"])


class TestDiffPrep:
    def test_split_extracts_files_and_drops_noise(self):
        files = split_diff(SAMPLE_DIFF)
        paths = [f.path for f in files]
        assert "src/auth.ts" in paths
        assert "README.md" in paths
        assert "pnpm-lock.yaml" not in paths  # lockfile filtered

    def test_ignored_patterns(self):
        assert is_ignored("pnpm-lock.yaml")
        assert is_ignored("apps/web/dist/bundle.min.js")
        assert is_ignored("assets/logo.png")
        assert not is_ignored("src/auth.ts")

    def test_total_budget_drops_tail_files(self):
        files = split_diff(SAMPLE_DIFF)
        kept, dropped = apply_total_budget(files, max_total_bytes=len(files[0].patch) + 10)
        assert len(kept) == 1
        assert dropped == len(files) - 1

    def test_budget_always_keeps_first_file(self):
        files = split_diff(SAMPLE_DIFF)
        kept, _ = apply_total_budget(files, max_total_bytes=1)
        assert len(kept) == 1  # never review zero files because of the budget


class TestFinding:
    def test_from_raw_normalizes(self):
        finding = Finding.from_raw(
            {
                "file": ".\\src\\auth.ts",
                "line": 11,
                "severity": "ABSURD",
                "category": "nonsense",
                "title": "  x  ",
                "detail": "d",
            }
        )
        assert finding is not None
        assert finding.file == "src/auth.ts"
        assert finding.severity == "medium"  # invalid → default
        assert finding.category == "bug"

    def test_from_raw_rejects_garbage(self):
        assert Finding.from_raw("nope") is None
        assert Finding.from_raw({"title": "no file"}) is None
        assert Finding.from_raw({"file": "f", "title": ""}) is None


class TestAnalyzer:
    def test_end_to_end_with_mock_provider(self):
        result = analyze(make_job(), SAMPLE_DIFF, MockProvider(), make_config())
        assert result.files_reviewed == 2  # lockfile dropped
        titles = [f.title for f in result.findings]
        assert any("credential" in t for t in titles)
        assert any("TODO" in t for t in titles)
        # severity ordering: high before low
        severities = [f.severity for f in result.findings]
        assert severities == sorted(severities, key=["critical", "high", "medium", "low", "style"].index)

    def test_hallucinated_files_dropped(self):
        class LyingProvider:
            name = "liar"

            def review(self, repo, pr_number, files):
                return [
                    {"file": "src/auth.ts", "severity": "high", "category": "bug",
                     "title": "real", "detail": "d"},
                    {"file": "made/up.ts", "severity": "critical", "category": "bug",
                     "title": "fake", "detail": "d"},
                ]

        result = analyze(make_job(), SAMPLE_DIFF, LyingProvider(), make_config())
        assert [f.title for f in result.findings] == ["real"]

    def test_findings_capped_and_deduped(self):
        class NoisyProvider:
            name = "noisy"

            def review(self, repo, pr_number, files):
                same = {"file": "src/auth.ts", "severity": "low", "category": "style",
                        "title": "dup", "detail": "d"}
                distinct = [
                    {"file": "src/auth.ts", "line": i, "severity": "low",
                     "category": "style", "title": f"finding {i}", "detail": "d"}
                    for i in range(30)
                ]
                return [same, dict(same)] + distinct

        result = analyze(make_job(), SAMPLE_DIFF, NoisyProvider(), make_config(max_findings=5))
        assert len(result.findings) == 5
        titles = [f.title for f in result.findings]
        assert len(titles) == len(set(titles))  # dedupe held

    def test_empty_diff_skips(self):
        result = analyze(make_job(), "", MockProvider(), make_config())
        assert result.skipped_reason is not None
        assert result.findings == []


class TestComment:
    def test_renders_findings(self):
        result = analyze(make_job(), SAMPLE_DIFF, MockProvider(), make_config())
        body = render_comment(result)
        assert MARKER in body
        assert "Shipyard review" in body
        assert "src/auth.ts" in body
        assert result.job.head_sha in body

    def test_renders_clean_review(self):
        result = analyze(make_job(), SAMPLE_DIFF, MockProvider(), make_config())
        result.findings = []
        body = render_comment(result)
        assert "No issues found" in body

    def test_renders_skip(self):
        result = analyze(make_job(), "", MockProvider(), make_config())
        body = render_comment(result)
        assert "Review skipped" in body


# ── Fixture-diff mode (REVIEWBOT_DIFF_FIXTURE) ──────────────────────────────


def test_fixture_diff_reviews_offline(tmp_path):
    """With a fixture configured, the pipeline runs with zero network calls."""
    from reviewbot.worker import process_review

    fixture = tmp_path / "demo.diff"
    fixture.write_text(SAMPLE_DIFF, encoding="utf-8")
    config = make_config(diff_fixture=str(fixture))
    provider = MockProvider()

    result = process_review(
        {
            "pullRequestId": "pr_1",
            "projectId": "proj_1",
            "repoFullName": "acme/storefront",
            "prNumber": 412,
            "headSha": "a1b2c3d4e5f6",
            "installationId": None,
        },
        provider,
        config,
        github=None,
    )

    assert result.skipped_reason is None
    assert result.files_reviewed >= 1
    assert any(f.category == "style" for f in result.findings)  # TODO marker


def test_fixture_diff_missing_file_skips_gracefully(tmp_path):
    """An unreadable fixture becomes a skip, not a crash/retry loop."""
    from reviewbot.worker import process_review

    config = make_config(diff_fixture=str(tmp_path / "nope.diff"))
    provider = MockProvider()

    result = process_review(
        {
            "pullRequestId": "pr_1",
            "projectId": "proj_1",
            "repoFullName": "acme/storefront",
            "prNumber": 412,
            "headSha": "a1b2c3d4e5f6",
            "installationId": None,
        },
        provider,
        config,
        github=None,
    )

    assert result.skipped_reason is not None
    assert "fixture diff unreadable" in result.skipped_reason


# ── Regression: BullMQ result must be JSON-serializable ─────────────────────


def test_result_summary_is_json_serializable(tmp_path):
    """The processor's stored return value must survive json.dumps — returning
    the raw ReviewResult dataclass made result storage fail AFTER side effects,
    so every review job retried (3x analysis + PR comments)."""
    import json

    from reviewbot.worker import process_review, result_summary

    fixture = tmp_path / "demo.diff"
    fixture.write_text(SAMPLE_DIFF, encoding="utf-8")
    config = make_config(diff_fixture=str(fixture))

    result = process_review(
        {
            "pullRequestId": "pr_1",
            "projectId": "proj_1",
            "repoFullName": "acme/storefront",
            "prNumber": 412,
            "headSha": "a1b2c3d4e5f6",
            "installationId": None,
        },
        MockProvider(),
        config,
        github=None,
    )

    summary = result_summary(result)
    encoded = json.loads(json.dumps(summary))
    assert encoded["pr"] == "acme/storefront#412"
    assert encoded["findings"] == len(result.findings)
    assert encoded["skipped"] is None


class TestMockCredentialPattern:
    def test_flags_string_literal_assignment(self):
        files = [FileDiff(path="a.ts", patch='+const apiKey = "sk_live_abcdef";')]
        assert any(
            "credential" in f["title"] for f in MockProvider().review("r", 1, files)
        )

    def test_ignores_type_annotations_and_identifiers(self):
        files = [
            FileDiff(path="a.ts", patch="+clientSecret: string;\n+const secretRef = secretName;")
        ]
        assert not any(
            "credential" in f["title"] for f in MockProvider().review("r", 1, files)
        )
