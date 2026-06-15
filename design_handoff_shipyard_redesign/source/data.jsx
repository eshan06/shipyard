/* Mock data for the Shipyard prototype — exposed on window.SY */
(function () {
  const PROJECTS = {
    storefront: { id: "storefront", name: "Storefront", repo: "acme/storefront", branch: "main", framework: "Next", color: "#4c9dff" },
    payments:   { id: "payments",   name: "Payments API", repo: "acme/payments-api", branch: "main", framework: "Node", color: "#2dd4bf" },
  };

  // status meta: tone maps to badge color class
  const STATUS = {
    running:   { label: "Running",   tone: "green", live: false },
    deploying: { label: "Deploying", tone: "blue",  live: true },
    building:  { label: "Building",  tone: "blue",  live: true },
    queued:    { label: "Queued",    tone: "amber", live: true },
    succeeded: { label: "Succeeded", tone: "green", live: false },
    failed:    { label: "Failed",    tone: "red",   live: false },
    stopped:   { label: "Stopped",   tone: "gray",  live: false },
    destroyed: { label: "Destroyed", tone: "gray",  live: false },
  };

  const previews = [
    { pr: 236, slug: "3ds-challenge", proj: "payments", branch: "feat/3ds-challenge", msg: "feat: 3DS challenge flow", status: "deploying", time: "about 15 hours ago", t: 15, progress: 62, commit: "5066473", pinned: false },
    { pr: 414, slug: "image-cdn", proj: "storefront", branch: "perf/image-cdn", msg: "perf: image CDN + responsive srcset", status: "building", time: "about 15 hours ago", t: 15, progress: 34, commit: "f607182", pinned: false },
    { pr: 412, slug: "pdp-redesign", proj: "storefront", branch: "feat/pdp-redesign", msg: "feat: redesigned product detail page", status: "running", time: "about 15 hours ago", t: 15, commit: "1029384", pinned: true, url: "pr-412-pdp-redesign.shipyard.run" },
    { pr: 233, slug: "idempotency-keys", proj: "payments", branch: "feat/idempotency-keys", msg: "feat: idempotency keys for charge endpoint", status: "stopped", time: "about 15 hours ago", t: 15, commit: "a1b2c3d", url: "pr-233-idempotency.shipyard.run" },
    { pr: 409, slug: "cart-rounding", proj: "storefront", branch: "fix/cart-rounding", msg: "fix: cart total rounding on multi-currency", status: "stopped", time: "about 15 hours ago", t: 15, commit: "9bd2210", url: "pr-409-cart-rounding.shipyard.run" },
    { pr: 230, slug: "webhook-backoff", proj: "payments", branch: "fix/webhook-backoff", msg: "fix: webhook retry backoff jitter", status: "failed", time: "about 16 hours ago", t: 16, commit: "2038475" },
    { pr: 401, slug: "wishlist", proj: "storefront", branch: "feat/wishlist", msg: "feat: wishlist (WIP)", status: "stopped", time: "1 day ago", t: 24, commit: "7c1d9e0" },
    { pr: 226, slug: "partial-refunds", proj: "payments", branch: "feat/partial-refunds", msg: "feat: refund partial amounts", status: "destroyed", time: "12 days ago", t: 288, commit: "b2c3d4e" },
    { pr: 398, slug: "header-hydration", proj: "storefront", branch: "fix/header-hydration", msg: "fix: hydration mismatch in header", status: "destroyed", time: "14 days ago", t: 336, commit: "e5f6071" },
  ];

  const deployments = [
    { status: "building",  commit: "f607182", pr: 414, proj: "storefront", trigger: "PR_OPENED", dur: null, durs: 0,    time: "about 15 hours ago" },
    { status: "deploying", commit: "5066473", pr: 236, proj: "payments",   trigger: "PR_OPENED", dur: null, durs: 0,    time: "about 15 hours ago" },
    { status: "succeeded", commit: "1029384", pr: 412, proj: "storefront", trigger: "PR_SYNC",   dur: "41.0s", durs: 41, time: "about 15 hours ago" },
    { status: "succeeded", commit: "a1b2c3d", pr: 233, proj: "payments",   trigger: "PR_SYNC",   dur: "1m 28s", durs: 88, time: "about 15 hours ago" },
    { status: "failed",    commit: "2038475", pr: 230, proj: "payments",   trigger: "PR_SYNC",   dur: "1m 15s", durs: 75, time: "about 16 hours ago" },
    { status: "failed",    commit: "a1b2c3d", pr: 412, proj: "storefront", trigger: "PR_OPENED", dur: "1m 15s", durs: 75, time: "3 days ago" },
    { status: "succeeded", commit: "1029384", pr: 412, proj: "storefront", trigger: "PR_OPENED", dur: "1m 4s",  durs: 64, time: "3 days ago" },
    { status: "succeeded", commit: "b2c3d4e", pr: 226, proj: "payments",   trigger: "PR_SYNC",   dur: "1m 34s", durs: 94, time: "4 days ago" },
    { status: "succeeded", commit: "d4e5f60", pr: 409, proj: "storefront", trigger: "PR_OPENED", dur: "1m 30s", durs: 90, time: "6 days ago" },
    { status: "succeeded", commit: "3047566", pr: 401, proj: "storefront", trigger: "PR_OPENED", dur: "1m 2s",  durs: 62, time: "13 days ago" },
    { status: "succeeded", commit: "e5f6071", pr: 398, proj: "storefront", trigger: "PR_OPENED", dur: "1m 27s", durs: 87, time: "15 days ago" },
  ];

  const builds = [
    {
      commit: "2038475", pr: 230, proj: "payments", branch: "fix/webhook-backoff", dur: "1m 12s", time: "about 16 hours ago",
      error: "tsc: src/webhooks/backoff.ts(58,7): error TS2532: Object is possibly 'undefined'. Build aborted before image export.",
      log: [
        ["t-dim", "$ pnpm install --frozen-lockfile"],
        ["t-dim", "Lockfile up to date, resolution step is skipped"],
        ["t-green", "Packages: +428 done in 6.1s"],
        ["t-dim", "$ pnpm build"],
        ["t-tx", "> payments-api@1.4.0 build"],
        ["t-tx", "> tsc -p tsconfig.json && tsup src/index.ts"],
        ["t-red", "src/webhooks/backoff.ts(58,7): error TS2532: Object is possibly 'undefined'."],
        ["t-dim", "    56 |   const next = schedule.get(attempt);"],
        ["t-dim", "    57 |   const jitter = Math.random() * next.window;"],
        ["t-red", "  > 58 |   return next.base + jitter;"],
        ["t-dim", "       |          ^^^^^^^^^"],
        ["t-red", "Found 1 error in src/webhooks/backoff.ts:58"],
        ["t-red", "ERROR  Build failed — exit code 2. Image export skipped."],
      ],
    },
    {
      commit: "a1b2c3d", pr: 412, proj: "storefront", branch: "feat/pdp-redesign", dur: "1m 12s", time: "3 days ago",
      error: "Type error: Property 'rating' does not exist on type 'Product'. (app/products/[sku]/page.tsx:42:18)",
      log: [
        ["t-dim", "$ pnpm install --frozen-lockfile"],
        ["t-green", "Packages: +611 done in 9.4s"],
        ["t-dim", "$ next build"],
        ["t-tx", "  ▲ Next.js 15.1.0"],
        ["t-blue", "   Creating an optimized production build ..."],
        ["t-green", " ✓ Compiled successfully"],
        ["t-blue", "   Linting and checking validity of types ..."],
        ["t-red", "Failed to compile."],
        ["t-amber", "app/products/[sku]/page.tsx:42:18"],
        ["t-red", "Type error: Property 'rating' does not exist on type 'Product'."],
        ["t-dim", "  40 |       <div className=\"flex items-center gap-2\">"],
        ["t-dim", "  41 |         <Stars value={product.rating} />"],
        ["t-red", "> 42 |         <span>{product.rating.toFixed(1)}</span>"],
        ["t-dim", "     |                  ^"],
        ["t-red", "ERROR  Build worker exited with code 1."],
      ],
    },
  ];

  // costs
  const spendSeries = [
    { d: "Jun 09", v: 2.95 }, { d: "Jun 10", v: 2.42 }, { d: "Jun 11", v: 1.98 },
    { d: "Jun 12", v: 2.30 }, { d: "Jun 13", v: 2.10 }, { d: "Jun 14", v: 1.22 }, { d: "Jun 15", v: 0.88 },
  ];
  const spendByProject = [
    { name: "Storefront", v: 8.24, color: "var(--acc)" },
    { name: "Payments API", v: 5.61, color: "var(--teal)" },
  ];
  const projectCostRows = [
    { name: "Storefront", previews: 6, builds: 41, est: 8.24 },
    { name: "Payments API", previews: 3, builds: 23, est: 5.61 },
  ];

  const team = {
    name: "Acme", slug: "acme", budget: 750.0, role: "OWNER", created: "Jan 15, 2026, 4:00 AM", id: "team_acme",
    spend: 13.85,
  };
  const members = [
    { name: "Nadia Cole", handle: "nadia", role: "OWNER", grad: "linear-gradient(150deg,#ff9a6b,#ff5c8a)" },
    { name: "Priya Anand", handle: "priya", role: "MEMBER", grad: "linear-gradient(150deg,#4c9dff,#7c6cff)" },
    { name: "Theo Marsh", handle: "theo", role: "MEMBER", grad: "linear-gradient(150deg,#2dd4bf,#34d27b)" },
    { name: "Dev Bot CI", handle: "ci-bot", role: "MEMBER", grad: "linear-gradient(150deg,#79808d,#3a3f4d)" },
  ];
  const tokens = [
    { name: "CI deploy token", prefix: "shpyd_ci…", used: "about 15 hours ago", expires: "Oct 12, 2026, 5:00 AM" },
  ];

  const notifications = [
    { tone: "red",   icon: "x-octagon",     html: "<b>Build failed</b> on PR #230 webhook-backoff", time: "16h ago" },
    { tone: "green", icon: "check",          html: "<b>PR #412</b> pdp-redesign is now running", time: "15h ago" },
    { tone: "blue",  icon: "rocket",         html: "<b>Deploy started</b> for PR #236 3ds-challenge", time: "15h ago" },
  ];

  window.SY = {
    PROJECTS, STATUS, previews, deployments, builds,
    spendSeries, spendByProject, projectCostRows, team, members, tokens, notifications,
    nav: [
      { id: "overview", label: "Overview", icon: "grid" },
      { id: "previews", label: "Previews", icon: "layers" },
      { id: "deployments", label: "Deployments", icon: "rocket" },
      { id: "builds", label: "Builds", icon: "terminal" },
      { id: "costs", label: "Costs", icon: "coin" },
      { id: "projects", label: "Projects", icon: "folder" },
      { id: "settings", label: "Settings", icon: "sliders" },
    ],
  };
})();
