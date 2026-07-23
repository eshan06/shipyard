"""Local-LLM review provider via Ollama.

Talks to a local Ollama server's ``/api/chat`` with ``format`` set to the
findings JSON schema (Ollama's structured-output mode), so no code or diff
content ever leaves the machine — the fully-local counterpart to the
Anthropic provider.
"""

from __future__ import annotations

import json

import httpx

from ..models import FileDiff
from .base import FINDINGS_SCHEMA, SYSTEM_PROMPT, ProviderError, build_user_prompt


class OllamaProvider:
    """Review diffs with a local model served by Ollama."""

    name = "ollama"

    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.1") -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model

    def review(self, repo: str, pr_number: int, files: list[FileDiff]) -> list[dict]:
        try:
            response = httpx.post(
                f"{self._base_url}/api/chat",
                json={
                    "model": self._model,
                    "stream": False,
                    "format": FINDINGS_SCHEMA,
                    "options": {"temperature": 0},
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": build_user_prompt(repo, pr_number, files)},
                    ],
                },
                timeout=600.0,  # local models can be slow on big diffs
            )
        except httpx.HTTPError as error:
            raise ProviderError(f"ollama request failed: {error}") from error
        if response.status_code != 200:
            raise ProviderError(f"ollama returned HTTP {response.status_code}: {response.text[:200]}")

        try:
            content = response.json()["message"]["content"]
            data = json.loads(content)
        except (KeyError, ValueError) as error:
            raise ProviderError(f"ollama returned unparseable output: {error}") from error

        findings = data.get("findings")
        return findings if isinstance(findings, list) else []
