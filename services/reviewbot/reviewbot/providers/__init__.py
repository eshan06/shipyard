"""Provider registry: REVIEWBOT_LLM value → provider instance."""

from __future__ import annotations

from ..config import Config
from .base import Provider, ProviderError
from .mock import MockProvider

__all__ = ["Provider", "ProviderError", "get_provider"]


def get_provider(config: Config) -> Provider:
    """Instantiate the configured review backend.

    Anthropic/Ollama imports are deferred so the mock path (tests, CI, local
    dev) needs neither SDK importable nor credentials present.
    """
    if config.llm == "anthropic":
        from .anthropic_provider import AnthropicProvider

        return AnthropicProvider(model=config.anthropic_model)
    if config.llm == "ollama":
        from .ollama_provider import OllamaProvider

        return OllamaProvider(base_url=config.ollama_url, model=config.ollama_model)
    return MockProvider()
