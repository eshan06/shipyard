"""GitHub App integration: installation tokens + posting review comments.

Mirrors the TS worker's ``github.ts`` (RS256 App JWT → installation token →
REST calls) so the two services authenticate identically. All methods are
best-effort from the worker's perspective — a failed comment post must never
fail the review job.
"""

from __future__ import annotations

import logging
import time

import httpx
import jwt

logger = logging.getLogger(__name__)

_API = "https://api.github.com"
_TOKEN_SKEW_SECONDS = 60


class GitHubApp:
    """Minimal GitHub App client (installation-token auth)."""

    def __init__(self, app_id: str, private_key_pem: str) -> None:
        self._app_id = app_id
        self._private_key = private_key_pem
        #: installation id -> (token, expires_at_epoch)
        self._tokens: dict[str, tuple[str, float]] = {}

    @classmethod
    def from_config(cls, app_id: str | None, private_key: str | None) -> "GitHubApp | None":
        """Build the client when both credentials are present, else None."""
        if not app_id or not private_key:
            return None
        return cls(app_id, private_key)

    def _app_jwt(self) -> str:
        """Mint a short-lived RS256 JWT identifying the App itself."""
        now = int(time.time())
        payload = {"iat": now - 30, "exp": now + 9 * 60, "iss": self._app_id}
        return jwt.encode(payload, self._private_key, algorithm="RS256")

    def installation_token(self, installation_id: str) -> str:
        """Get (or refresh) an installation access token."""
        cached = self._tokens.get(installation_id)
        if cached and cached[1] - _TOKEN_SKEW_SECONDS > time.time():
            return cached[0]

        response = httpx.post(
            f"{_API}/app/installations/{installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {self._app_jwt()}",
                "Accept": "application/vnd.github+json",
                "User-Agent": "shipyard-reviewbot",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        # expires_at is ISO-8601; keep it simple with a fixed 55-minute window
        # (App tokens live 60 minutes).
        self._tokens[installation_id] = (data["token"], time.time() + 55 * 60)
        return data["token"]

    def post_pr_comment(
        self,
        repo_full_name: str,
        pr_number: int,
        installation_id: str,
        body: str,
    ) -> bool:
        """Post an issue comment on the PR. Returns whether it succeeded."""
        try:
            token = self.installation_token(installation_id)
            response = httpx.post(
                f"{_API}/repos/{repo_full_name}/issues/{pr_number}/comments",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "shipyard-reviewbot",
                },
                json={"body": body},
                timeout=30.0,
            )
            if response.status_code >= 300:
                logger.warning(
                    "PR comment post failed: HTTP %s for %s#%s",
                    response.status_code,
                    repo_full_name,
                    pr_number,
                )
                return False
            return True
        except httpx.HTTPError as error:
            logger.warning("PR comment post errored for %s#%s: %s", repo_full_name, pr_number, error)
            return False
