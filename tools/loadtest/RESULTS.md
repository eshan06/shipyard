# Load test results

Measured against the **production build** of the control-plane API
(`node dist/index.js`, single process) with seeded demo data, on
2026-07-23.

## Environment

| | |
| --- | --- |
| Host | AMD Ryzen 7 8840HS (8c/16t), 14 GB RAM, Windows 11 |
| API | `apps/api` prod build, single Node 24 process |
| DB / cache | Postgres 16 + Redis 7 in Docker Desktop, same host |
| Generator | Locust 2.46 (same host — client competes with the server for CPU, so numbers are conservative) |
| Rate limiter | `RATE_LIMIT_MAX` raised for the run — every simulated user shares one IP, so the default per-IP abuse limit (200/min) floors the numbers otherwise |

Methodology notes: target `127.0.0.1`, not `localhost` (Windows adds a ~2s
IPv6-fallback penalty per fresh connection to `localhost` — it polluted the
first run's login numbers and is exactly the kind of artifact a load test
exists to catch). Scenario mix: previews list/detail, deployments (global +
per-preview), costs summary, notifications, profile — all authenticated via
session cookie after one dev-login per user.

## Realistic profile — 50 concurrent dashboard users

Think time 0.5–2s between actions (browsing humans). 60s run.

| Metric | Value |
| --- | --- |
| Requests | 2,394 |
| Failures | **0** |
| Throughput | ~40 req/s (think-time-limited — the client is the bottleneck, not the API) |
| Latency (aggregate) | p50 **9 ms** · p95 **14 ms** · p99 **24 ms** · max 46 ms |

## Stress profile — 100 users, near-zero think time

`LOADTEST_PROFILE=stress` (20–100 ms think time), 60s run: the server, not
the scenario, is the limit.

| Metric | Value |
| --- | --- |
| Requests | 36,607 |
| Failures | **0** |
| Throughput | **~615 req/s sustained** |
| Latency (aggregate) | p50 **56 ms** · p95 **84 ms** · p99 **100 ms** · max 170 ms |

Heaviest endpoint under stress (`GET /previews`, 9.6k hits): p50 53 ms,
p95 78 ms, p99 94 ms.

## Reproduce

```bash
pip install locust
# API must be a prod build with a raised rate limit:
#   RATE_LIMIT_MAX=1000000 node apps/api/dist/index.js
locust -f tools/loadtest/locustfile.py --headless -u 50 -r 10 -t 60s \
    --host http://127.0.0.1:4000
LOADTEST_PROFILE=stress locust -f tools/loadtest/locustfile.py --headless \
    -u 100 -r 25 -t 60s --host http://127.0.0.1:4000
```
