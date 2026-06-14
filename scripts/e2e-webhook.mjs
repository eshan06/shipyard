/**
 * End-to-end smoke (black-box, through the API): dev-login, POST a signed GitHub
 * pull_request webhook, then poll the previews API until the worker deploys the
 * new preview to RUNNING (mock driver). Requires API(:4000)+worker running, DB
 * seeded, DEV_AUTH=true, GITHUB_WEBHOOK_SECRET set.
 */
import crypto from "node:crypto";

const API = process.env.PUBLIC_API_URL ?? "http://localhost:4000";
const SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const REPO = "acme/storefront";
const PRNUM = Number(process.argv[2] ?? 952);
const BRANCH = `feat/e2e-pr-${PRNUM}`;

const login = await fetch(`${API}/api/v1/auth/dev-login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "alice@acme.dev" }),
});
const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
console.log("[e2e] dev-login", login.status, "cookie:", cookie ? "ok" : "MISSING");

const payload = {
  action: "opened",
  number: PRNUM,
  pull_request: {
    number: PRNUM, title: "feat: e2e smoke — wishlist sharing", state: "open",
    html_url: `https://github.com/${REPO}/pull/${PRNUM}`, merged: false, draft: false,
    head: { ref: BRANCH, sha: "e2e1234567890abcdef1234567890abcdef123456" },
    base: { ref: "main" },
    user: { login: "alicen", avatar_url: "https://avatars.githubusercontent.com/alicen?v=4" },
    labels: [{ name: "frontend" }],
  },
  repository: { full_name: REPO, id: "548921001" },
};
const body = JSON.stringify(payload);
const sig = "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");
const wh = await fetch(`${API}/api/v1/webhooks/github`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json", "X-Hub-Signature-256": sig,
    "X-GitHub-Event": "pull_request", "X-GitHub-Delivery": crypto.randomUUID(),
  },
  body,
});
console.log("[e2e] webhook ->", wh.status, (await wh.text()).slice(0, 200));

let p = null;
for (let i = 0; i < 45; i++) {
  const r = await fetch(`${API}/api/v1/previews?limit=100`, { headers: { cookie } });
  const d = await r.json();
  p = (d.data ?? []).find((x) => x.branch === BRANCH || x.pullRequest?.number === PRNUM) ?? null;
  if (p) {
    console.log(`[e2e t+${i}s] ${p.slug} status=${p.status} url=${p.url ?? "-"}`);
    if (["RUNNING", "FAILED", "DEGRADED"].includes(p.status)) break;
  } else console.log(`[e2e t+${i}s] waiting for preview…`);
  await new Promise((r) => setTimeout(r, 1000));
}
console.log(p ? `[e2e] FINAL status=${p.status} url=${p.url}` : "[e2e] NO PREVIEW CREATED");
process.exit(p && p.status === "RUNNING" ? 0 : 1);
