/**
 * Build the marketing site into `site/dist/`.
 *
 * The page is a single static HTML file with no framework and no runtime
 * dependencies; this script only assembles a deployable directory:
 *
 *  1. copies `index.html`, substituting the demo URL
 *  2. copies the screenshots from `docs/media/` into `dist/img/`
 *
 * The screenshots live in `docs/media/` because the README uses them too —
 * copying at build time keeps one source of truth instead of a second set of
 * PNGs that silently drifts.
 *
 * Usage:
 *   DEMO_URL=https://your-demo.vercel.app node build.mjs
 */

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SITE, "..");
const DIST = path.join(SITE, "dist");
const MEDIA = path.join(REPO_ROOT, "docs", "media");

/** Screenshots referenced by index.html. */
const IMAGES = ["overview.png", "preview-detail.png", "reviewbot.png", "cli.png"];

/**
 * Where the "Try the demo" buttons point.
 *
 * Set `DEMO_URL` in the host's build environment. The fallback is the repo, so
 * an unconfigured build still ships working links rather than dead ones.
 */
const DEMO_URL = process.env.DEMO_URL?.trim() || "https://github.com/eshan06/shipyard";

await rm(DIST, { recursive: true, force: true });
await mkdir(path.join(DIST, "img"), { recursive: true });

const html = await readFile(path.join(SITE, "index.html"), "utf8");
await writeFile(path.join(DIST, "index.html"), html.replaceAll("__DEMO_URL__", DEMO_URL));

for (const image of IMAGES) {
  await cp(path.join(MEDIA, image), path.join(DIST, "img", image));
}

console.log(`site → dist/ (demo URL: ${DEMO_URL})`);
