"""Locust load scenarios for the Shipyard control-plane API.

Models a fleet of authenticated dashboard users: each simulated user
dev-logs-in once (session cookie), then browses with a realistic mix —
listing previews, opening detail pages, checking deployments/costs, and
polling notifications.

Run against a *production-mode* API (`node dist/index.js`), not `tsx watch`,
and raise the per-IP rate limit for the run — all simulated users share one
IP, so the default abuse limit (200/min) floors the numbers long before the
API does:

    RATE_LIMIT_MAX=1000000 node dist/index.js

Usage (headless, 60s at 50 users):

    locust -f tools/loadtest/locustfile.py --headless \
        -u 50 -r 10 -t 60s --host http://127.0.0.1:4000 \
        --csv tools/loadtest/out/run

Use 127.0.0.1, not localhost: on Windows, each fresh connection to
`localhost` can eat a ~2s IPv6-fallback penalty that has nothing to do with
the API under test.

See RESULTS.md for measured numbers and methodology.
"""

from __future__ import annotations

import os
import random

from locust import HttpUser, between, task

#: Seeded dev-auth users (packages/db/prisma/seed.ts).
USERS = ["alice@acme.dev", "bob@acme.dev", "carol@acme.dev", "erin@acme.dev"]

#: LOADTEST_PROFILE=stress drops think time to near zero to measure capacity
#: (max sustained RPS) instead of realistic browsing behavior.
STRESS = os.environ.get("LOADTEST_PROFILE", "").lower() == "stress"


class DashboardUser(HttpUser):
    """An authenticated dashboard user browsing the control plane."""

    #: Think time between actions — a browsing human by default; near-zero
    #: under the stress profile so the server (not the client) is the limit.
    wait_time = between(0.02, 0.1) if STRESS else between(0.5, 2.0)

    def on_start(self) -> None:
        """Dev-login once; the session cookie authenticates everything after."""
        email = random.choice(USERS)
        with self.client.post(
            "/api/v1/auth/dev-login",
            json={"email": email},
            name="POST /auth/dev-login",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(f"login failed: HTTP {response.status_code}")
                self.environment.runner.quit()
                return
        # Cache preview ids for detail-page hits.
        listing = self.client.get(
            "/api/v1/previews?limit=50", name="GET /previews (warmup)"
        ).json()
        self.preview_ids = [p["id"] for p in listing.get("data", [])] or [""]

    @task(5)
    def list_previews(self) -> None:
        self.client.get("/api/v1/previews?limit=20", name="GET /previews")

    @task(4)
    def preview_detail(self) -> None:
        preview_id = random.choice(self.preview_ids)
        if not preview_id:
            return
        self.client.get(f"/api/v1/previews/{preview_id}", name="GET /previews/:id")

    @task(2)
    def preview_deployments(self) -> None:
        preview_id = random.choice(self.preview_ids)
        if not preview_id:
            return
        self.client.get(
            f"/api/v1/deployments?previewId={preview_id}&limit=10",
            name="GET /deployments?previewId",
        )

    @task(3)
    def list_deployments(self) -> None:
        self.client.get("/api/v1/deployments?limit=20", name="GET /deployments")

    @task(2)
    def costs_summary(self) -> None:
        self.client.get("/api/v1/costs/summary", name="GET /costs/summary")

    @task(2)
    def notifications(self) -> None:
        self.client.get(
            "/api/v1/notifications?limit=10", name="GET /notifications"
        )

    @task(1)
    def me(self) -> None:
        self.client.get("/api/v1/me", name="GET /me")
