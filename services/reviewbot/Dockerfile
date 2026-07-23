# Shipyard reviewbot — Python BullMQ worker.
# Build from the repo root or this directory; no monorepo context needed.
FROM python:3.12-slim

# Non-root, matching the hardening posture of the other Shipyard images.
RUN useradd --create-home --uid 10001 reviewbot
WORKDIR /app

COPY pyproject.toml ./
COPY reviewbot ./reviewbot
RUN pip install --no-cache-dir .

USER reviewbot
# Advisory worker: no ports; health = process liveness.
CMD ["python", "-m", "reviewbot"]
