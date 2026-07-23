# reviewbot — LLM pull-request reviews

A Python worker that reviews every pull request Shipyard sees. When a PR is
opened or pushed, the API enqueues a `review` job (BullMQ, deduplicated per
head commit) alongside the preview deploy; this service consumes the job,
fetches the PR diff from GitHub, runs it through an LLM, and posts the
findings back to the PR as a comment.

```
GitHub PR webhook ──▶ apps/api ──▶ BullMQ `review` queue ──▶ reviewbot
                                                    │
                             GitHub diff ◀──────────┤
                             LLM analysis ──────────┤
                             PR comment ◀───────────┘
```

Reviews are strictly **advisory**: enqueue failures are swallowed by the API,
and no failure here can affect the deploy pipeline.

## Providers

Selected with `REVIEWBOT_LLM`:

| Provider | What it is |
| --- | --- |
| `mock` (default) | Deterministic pattern checks (credentials, `eval`, empty catch, TODO, debug output). No network, no cost — the review-pipeline analogue of `DEPLOY_DRIVER=mock`. |
| `anthropic` | Claude (`claude-opus-4-8` by default) via the official SDK, with structured outputs (JSON-schema-constrained findings) and adaptive thinking. Needs `ANTHROPIC_API_KEY`. |
| `ollama` | A local model via an Ollama server — code never leaves the machine. Needs `OLLAMA_URL` (+ a pulled model). |

Every provider returns the same findings shape; the analyzer hardens the
output regardless of source: findings referencing files not in the diff are
dropped (LLM hallucination guard), duplicates collapse, severities order the
report, and a cap bounds comment size. The prompt also instructs the model to
treat diff content as data, not instructions (prompt-injection resistance),
and to flag manipulation attempts as security findings.

## Configuration

| Env | Default | Meaning |
| --- | --- | --- |
| `REDIS_URL` | — (required) | Same Redis the API/worker use |
| `REVIEWBOT_LLM` | `mock` | `mock` \| `anthropic` \| `ollama` |
| `REVIEWBOT_ANTHROPIC_MODEL` | `claude-opus-4-8` | Anthropic model override |
| `OLLAMA_URL` / `REVIEWBOT_OLLAMA_MODEL` | `http://localhost:11434` / `llama3.1` | Ollama settings |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` | unset | Same App the TS worker uses; enables private-repo diffs + PR comments. Without them, public-repo diffs are fetched anonymously and findings are only logged. |
| `REVIEWBOT_MAX_DIFF_BYTES` | `200000` | Total diff budget sent to the LLM |
| `REVIEWBOT_MAX_FINDINGS` | `15` | Findings cap per review |
| `REVIEWBOT_CONCURRENCY` | `2` | Parallel reviews |

Lockfiles, minified bundles, sourcemaps, and binary assets are never sent to
the LLM; a per-file patch cap plus the total budget keep prompts (and cost)
bounded on huge PRs.

## Run

```bash
cd services/reviewbot
python -m venv .venv && .venv/Scripts/pip install -e .[dev]   # or bin/ on POSIX
REDIS_URL=redis://127.0.0.1:6379 REVIEWBOT_LLM=mock .venv/Scripts/python -m reviewbot
```

Tests (no network, no Redis needed):

```bash
.venv/Scripts/python -m pytest
```

## Cross-language contract

The queue payload is defined once, in `packages/core/src/jobs.ts`
(`ReviewJobSchema`, `QUEUE.review`), and mirrored here in
`reviewbot/models.py` (`ReviewJob.from_payload`). Changes must be additive
(new optional fields only) and made in both places.
