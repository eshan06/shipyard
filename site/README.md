# Shipyard marketing site

The landing page that fronts the [interactive demo](../docs/DEMO.md). A single
static HTML file — no framework, no runtime dependencies, no JavaScript
required to render it.

```bash
DEMO_URL=https://your-demo.vercel.app node build.mjs   # → site/dist/
npx serve dist                                          # preview locally
```

`build.mjs` copies `index.html` into `dist/`, substitutes `__DEMO_URL__` with
`$DEMO_URL`, and copies the screenshots from `docs/media/` into `dist/img/`.
The screenshots are not duplicated in this folder on purpose: the README uses
the same files, and a second copy would drift.

## Deploying (Vercel)

Import the repo as a **second Vercel project**, separate from the demo:

| Setting | Value |
| --- | --- |
| Root Directory | `site` |
| Framework Preset | Other |
| Build Command | `node build.mjs` |
| Output Directory | `dist` |
| Install Command | leave blank (no dependencies) |

Add one environment variable so the call-to-action buttons point at the live
demo rather than falling back to the GitHub repo:

```
DEMO_URL = https://<your-demo-project>.vercel.app
```

Leave "Include files outside the root directory" **on** — the build reads
`docs/media/`.

With a custom domain, put this project on the apex (`shipyard.dev`) and the
demo on a subdomain (`demo.shipyard.dev`), then set `DEMO_URL` to the
subdomain.

## Editing

Everything is in `index.html`: tokens at the top of the `<style>` block are
copied from the dashboard's design system (`apps/web/src/app/shipyard.css`), so
the page and the product stay visually consistent. The performance figures in
the metrics band come from [`tools/loadtest/RESULTS.md`](../tools/loadtest/RESULTS.md)
— update both together.
