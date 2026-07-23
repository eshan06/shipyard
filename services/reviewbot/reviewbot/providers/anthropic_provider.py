"""Claude-backed review provider (official ``anthropic`` SDK).

Uses structured outputs (``output_config.format`` with a JSON schema) so the
response is guaranteed-parseable findings JSON, and adaptive thinking so the
model can reason through non-obvious diffs. Credentials resolve the standard
SDK way (``ANTHROPIC_API_KEY`` or an ``ant auth login`` profile).
"""

from __future__ import annotations

import json
import logging

import anthropic

from ..models import FileDiff
from .base import FINDINGS_SCHEMA, SYSTEM_PROMPT, ProviderError, build_user_prompt

logger = logging.getLogger(__name__)


class AnthropicProvider:
    """Review diffs with Claude."""

    name = "anthropic"

    def __init__(self, model: str = "claude-opus-4-8") -> None:
        self._model = model
        self._client = anthropic.Anthropic()

    def review(self, repo: str, pr_number: int, files: list[FileDiff]) -> list[dict]:
        try:
            response = self._client.messages.create(
                model=self._model,
                max_tokens=16000,
                thinking={"type": "adaptive"},
                system=SYSTEM_PROMPT,
                output_config={"format": {"type": "json_schema", "schema": FINDINGS_SCHEMA}},
                messages=[
                    {"role": "user", "content": build_user_prompt(repo, pr_number, files)},
                ],
            )
        except anthropic.RateLimitError as error:
            raise ProviderError(f"anthropic rate limited: {error}") from error
        except anthropic.APIStatusError as error:
            # 4xx (bad request/auth) are not retryable-by-waiting, but the job
            # layer treats ProviderError uniformly; message carries the status.
            raise ProviderError(f"anthropic API error {error.status_code}: {error.message}") from error
        except anthropic.APIConnectionError as error:
            raise ProviderError(f"anthropic connection error: {error}") from error

        if response.stop_reason == "refusal":
            # Safety classifiers declined (e.g. exploit-heavy diffs). Treat as
            # "no findings from this provider" rather than a failure.
            logger.warning("anthropic refused review for %s#%s", repo, pr_number)
            return []
        if response.stop_reason == "max_tokens":
            logger.warning("anthropic hit max_tokens for %s#%s; findings may be partial", repo, pr_number)

        text = "".join(block.text for block in response.content if block.type == "text")
        try:
            data = json.loads(text)
        except json.JSONDecodeError as error:
            raise ProviderError(f"anthropic returned non-JSON output: {error}") from error

        findings = data.get("findings")
        return findings if isinstance(findings, list) else []
