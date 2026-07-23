"""Tests for the worker's job handling (process_review) with fakes."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from reviewbot.models import InvalidJobError
from reviewbot.providers.mock import MockProvider
from reviewbot.worker import process_review

from .test_pipeline import SAMPLE_DIFF, make_config


PAYLOAD = dict(
    pullRequestId="pr_1",
    projectId="proj_1",
    repoFullName="acme/storefront",
    prNumber=412,
    headSha="a1b2c3d4e5f6",
    installationId=None,
)


class TestProcessReview:
    def test_happy_path_no_github(self):
        with patch("reviewbot.worker.fetch_diff", return_value=SAMPLE_DIFF) as fetch:
            result = process_review(PAYLOAD, MockProvider(), make_config(), github=None)
        fetch.assert_called_once_with("acme/storefront", 412, None)
        assert result.files_reviewed == 2
        assert result.findings

    def test_invalid_payload_raises_invalid_job(self):
        with pytest.raises(InvalidJobError):
            process_review({"nope": True}, MockProvider(), make_config(), github=None)

    def test_diff_unavailable_becomes_skip_not_failure(self):
        from reviewbot.diff import DiffUnavailableError

        with patch(
            "reviewbot.worker.fetch_diff",
            side_effect=DiffUnavailableError("HTTP 404"),
        ):
            result = process_review(PAYLOAD, MockProvider(), make_config(), github=None)
        assert result.skipped_reason is not None
        assert result.findings == []

    def test_posts_comment_when_github_configured(self):
        class FakeGitHub:
            posted: list[tuple] = []

            def installation_token(self, installation_id):
                return "tok"

            def post_pr_comment(self, repo, pr, installation_id, body):
                self.posted.append((repo, pr, installation_id, body))
                return True

        payload = dict(PAYLOAD, installationId="inst_1")
        fake = FakeGitHub()
        with patch("reviewbot.worker.fetch_diff", return_value=SAMPLE_DIFF):
            process_review(payload, MockProvider(), make_config(), github=fake)

        assert len(fake.posted) == 1
        repo, pr, installation_id, body = fake.posted[0]
        assert (repo, pr, installation_id) == ("acme/storefront", 412, "inst_1")
        assert "Shipyard review" in body

    def test_no_comment_when_skipped(self):
        from reviewbot.diff import DiffUnavailableError

        class FakeGitHub:
            posted = 0

            def installation_token(self, installation_id):
                return "tok"

            def post_pr_comment(self, *args):
                type(self).posted += 1
                return True

        payload = dict(PAYLOAD, installationId="inst_1")
        with patch(
            "reviewbot.worker.fetch_diff",
            side_effect=DiffUnavailableError("rate limited"),
        ):
            process_review(payload, MockProvider(), make_config(), github=FakeGitHub())
        assert FakeGitHub.posted == 0
