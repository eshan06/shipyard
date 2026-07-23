"""Entrypoint: ``python -m reviewbot``."""

import asyncio

from .worker import run

if __name__ == "__main__":
    asyncio.run(run())
