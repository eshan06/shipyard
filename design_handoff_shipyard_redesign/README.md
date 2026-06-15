# Handoff: Shipyard — Dashboard Redesign

A complete redesign of the **Shipyard** app — a preview-environments manager (a temporary live deploy is created for every pull request). This bundle redesigns all 7 authenticated pages: **Overview, Previews, Deployments, Builds, Costs, Projects, Settings.**

---

## About the Design Files

The files in `source/` are **design references built in HTML/CSS/React-via-Babel**. They are prototypes that demonstrate the intended **look, layout, and interaction** — they are **not** meant to be shipped as-is.

**Your task:** recreate these designs inside the target codebase using its **existing stack and conventions** (e.g. Next.js + Tailwind, Vite + CSS Modules, etc.). If no frontend exists yet, the recommended stack is **React + TypeScript + Vite**, CSS variables (or Tailwind with the token values below), and an icon library such as **lucide-react** (the prototype hand-rolls equivalent stroke icons; map them to lucide names — see Assets).

Do not copy the Babel-in-browser setup or the `window.*` global-sharing pattern — those are prototype-only constraints. Componentize properly in the real codebase.

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, radii, and interactions are all specified below and in `source/styles.css`. Recreate pixel-faithfully using the codebase's primitives. All hex values, font sizes, and spacings are exact and taken from `styles.css :root` and the component CSS.

---

## Design Language

**"Engineering terminal"** — dense, technical, mono-forward, dark and refined.

- Near-black cool canvas with a faint dotted grid; layered panels separated by hairline borders.
- **Magenta** (`#ff5c8a`) is the single brand accent — used sparingly for: logo, active nav, primary buttons, the brand chart series, key highlights. **Never** use magenta for status.
- **Status colors are strictly semantic** and never reused decoratively: green = running/succeeded, blue = building/deploying, red = failed, amber = warning/queued, gray = stopped/destroyed.
- **Two typefaces:** Space Grotesk (headings, UI, body) + JetBrains Mono (all data, IDs, commit hashes, timestamps, labels, code, metrics). Mono usage is heavy and intentional — it carries the "terminal" feel.
- Microlabels (stat labels, section meta, nav groups) are uppercase JetBrains Mono with wide letter-spacing.
- Status dots pulse when a state is live (building/deploying/running). Terminal-style log blocks (traffic-light bar + line numbers + colored tokens) appear in Deployments and Builds.

---

## Design Tokens

Source of truth: `source/styles.css` (`:root`). Reproduce these exactly.

### Color — canvas & panels
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0a0b0f` | App background (with dotted grid overlay on content area) |
| `--panel` | `#101218` | Cards, panels, inputs |
| `--panel-2` | `#14161d` | Table header, hover surfaces, menus |
| `--panel-3` | `#181b23` | Pills, nested chips, icon wells |
| `--inset` | `#0c0d12` | Insets (URL chips, progress tracks, terminal bg variants) |
| Terminal bg | `#07080b` | `.term` background |

### Color — borders
| Token | Value |
|---|---|
| `--line` | `rgba(255,255,255,0.075)` |
| `--line-strong` | `rgba(255,255,255,0.14)` |
| `--line-soft` | `rgba(255,255,255,0.045)` |

### Color — text
| Token | Hex |
|---|---|
| `--tx` (primary) | `#e8eaf0` |
| `--tx-mid` | `#9aa1ad` |
| `--tx-dim` | `#6a7280` |
| `--tx-faint` | `#474d58` |

### Color — brand accent (magenta)
| Token | Hex / value |
|---|---|
| `--acc` | `#ff5c8a` |
| `--acc-bright` | `#ff7aa3` (hover, accent text) |
| `--acc-deep` | `#e6396f` (gradients) |
| `--acc-soft` | `rgba(255,92,138,0.13)` (soft bg) |
| `--acc-line` | `rgba(255,92,138,0.32)` (soft border) |
| `--acc-glow` | `rgba(255,92,138,0.22)` (shadows) |

### Color — semantic status
Each has a base, a `-soft` background (`alpha ~0.13`), and a `-line` border (`alpha ~0.30`).
| Status | Base hex | Applies to |
|---|---|---|
| green | `#34d27b` | running, succeeded, healthy |
| blue | `#4c9dff` | building, deploying |
| red | `#ff5b4d` | failed |
| amber | `#f5b13d` | queued, warning |
| teal | `#2dd4bf` | secondary chart series (Payments API) |
| gray | `#79808d` | stopped, destroyed, neutral |

### Typography
- **Sans:** `"Space Grotesk", "Segoe UI", system-ui, sans-serif` — weights 400/500/600/700.
- **Mono:** `"JetBrains Mono", ui-monospace, Menlo, monospace` — weights 400/500/600/700.
- Global body: 14px / line-height 1.45 / `letter-spacing: -0.01em`.
- Page title (`.ptitle`): 26px / 600 / `-0.035em`.
- Panel title: 14.5px / 600 / `-0.02em`.
- Stat value (`.stat-val`): 31px / 600 / `-0.04em` / tabular-nums.
- Stat label / section microlabel: 10px mono, `letter-spacing 0.13em`, uppercase, `--tx-dim`.
- Badge / pill / meta text: 10.5–11.5px mono.
- Body/secondary text: 12.5–13.5px sans.

### Spacing, radii, shadows
- Radii: `--radius: 9px` (cards), `--radius-sm: 6px` (badges/pills/chips), `--radius-lg: 14px` (large panels, table wrap, command palette).
- Card padding: 14–18px. Page padding: `30px 32px 80px`, `max-width: 1380px`, centered.
- Grid gaps: 14–18px.
- `--shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 28px -12px rgba(0,0,0,.55)` (card hover lift).
- `--shadow-lg: 0 24px 60px -20px rgba(0,0,0,.7)` (menus, command palette).
- Sidebar width: 244px. Topbar height: 60px.
- Content canvas texture: `radial-gradient(rgba(255,255,255,0.022) 1px, transparent 1px)` at `background-size: 22px 22px`.

---

## Global Shell (every page)

**Two-column app grid:** `grid-template-columns: 244px 1fr; height: 100vh`. Left sidebar fixed; right column is `.main` (topbar + scrollable content).

### Sidebar (`244px`, full height, `border-right: var(--line)`)
- **Brand** (top, with bottom hairline): 34×34 rounded square (`radius 9px`) with magenta→`--acc-deep` gradient holding a white **anchor** icon; wordmark "Shipyard" (16px/600) over a mono microlabel "PREVIEW ENVS" (8.5px, `letter-spacing 0.18em`, uppercase).
- **Nav** group, labeled "WORKSPACE" (mono microlabel). 7 items, each: 17px icon + label (13.5px/500), `padding 8px 11px`, `radius 8px`. Optional right-aligned mono count.
  - Default: `--tx-mid`. Hover: bg `--hover`, text `--tx`.
  - **Active:** bg `--acc-soft`, text `#fff`, icon `--acc-bright`, plus a 3px magenta indicator bar on the far left (`box-shadow: 0 0 12px --acc-glow`). Counts turn `--acc-bright`.
  - Nav order + icons + counts: Overview (grid), Previews (layers, count 9), Deployments (rocket), Builds (terminal, count 2), Costs (coin), Projects (folder), Settings (sliders).
- **Footer** (top hairline): green pulsing dot + "All systems operational" (mono 11px); below it `region · iad1 · v2.8.0` (mono 10px, `--tx-faint`).

### Topbar (`height 60px`, bottom hairline, `background: rgba(10,11,15,0.7)` + `backdrop-filter: blur(10px)`)
- **Left — terminal breadcrumb:** mono `~/` (`--tx-faint`) + current page id (`--tx`) + a blinking 8px magenta block caret (`@keyframes blink` 1.15s steps).
- **Right cluster** (gap 9px): 
  - **Search/command bar** (`min-width 188px`): search icon + "Search or jump to…" + a `⌘K` kbd chip. Click opens the command palette.
  - **Team switcher:** 20px "AC" gradient avatar + "Acme" + chevrons-up-down. Opens a dropdown (Acme ✓, Labs, — , + Create team).
  - **Notifications** icon button with a magenta unread dot. Opens a 320px panel of 3 notification items (tinted icon well + html message + mono time).
  - **Theme** moon icon button (decorative toggle).
  - **Avatar:** 34px rounded square, `#ff9a6b→--acc` gradient, "NC" initials, dark text.

### Content
- Scroll container with the dotted-grid background. Inner `.page` is `max-width 1380px`, centered, padded.
- Page entrance: `@keyframes pgin` — `opacity 0 → 1`, `translateY(6px → 0)`, 0.22s. (Note: gate this behind a mounted/active flag so SSR/print/reduced-motion show content.)

### Page header pattern (`.phead`)
Flex row: left = `.ptitle` (26px/600) + `.psub` (13.5px `--tx-mid`); right = action cluster (filters, search, primary button), right-aligned, wraps.

---

## Screens / Views

### 1. Overview  ·  `screenshots/01-overview.png`
**Purpose:** at-a-glance health of preview environments + recent activity.
- Header actions: "View previews" (ghost btn) + "New preview" (primary magenta btn).
- **Stat row** — 4 equal cards (`grid cols-4`, gap 14). Each `.stat` card: top-light gradient (`--panel → #0d0f15`), a 1px top sheen line, label (mono uppercase) + 30px tinted icon well, big tabular value, footer with a `.delta` chip (up=green / down=red / flat=gray, with trend icon) + mono subtext, and a 78×26 **sparkline** (SVG, gradient fill) pinned bottom-right.
  - Active previews: `3` / "9 total" / cube icon (acc tint) / +2 up / magenta spark.
  - Running: `1` / "2 building" / activity icon (green) / "live" flat / green spark.
  - Deploys today: `5` / "1 failed" / rocket icon (blue) / +3 up / blue spark.
  - Est. monthly cost: `$13.85` / "current period" / coin icon / −18% down / teal spark.
- **Two-column** (`1.15fr 1fr`, gap 18):
  - **Recent deployments** panel: header with title + "View all →" link. A vertical **timeline** of 8 rows — colored status dot (pulses if live) at left, then a small status badge + "PR #nnn" + project name, a mono meta line (`git-commit` icon + commit · trigger pill · relative time), right-aligned mono duration + up-right arrow. Rows clickable → Deployments.
  - **Active previews** panel: header + "View all →". Cards for each deploying/building/running preview (PR id + slug + project·branch + status badge; building/deploying show a blue progress bar; running shows a mono URL chip). Plus a summary card: green check + "6 idle previews · $0.00/hr while stopped".

### 2. Previews  ·  `screenshots/02-previews.png`
**Purpose:** browse/filter every preview environment.
- Header actions: **All projects** select, **All statuses** select (both real filters), "New preview" primary btn.
- **Card grid** `repeat(3, 1fr)` (2-col under 1180px), gap 15. Each `.pvcard`:
  - 2px left status stripe (`--statc` = the status color).
  - Top: optional magenta `zap` pin icon + mono "PR #nnn" + bold slug; project name (mono, dim) under it; status badge top-right.
  - Two mono meta rows: `git-branch` + branch, `git-pull-request` + "#nnn message".
  - building/deploying → indeterminate blue progress bar; running → globe + URL chip.
  - Footer (top hairline): mono relative time + actions — "Open ↗" (ghost, when running/stopped & has URL), "Details" (outline), and a `⋯` menu (Start/Stop, Redeploy, Open PR, — , Destroy[danger]).
  - Hover: `translateY(-2px)`, border → `--line-strong`, `--shadow`.
- 9 preview records (see Data). Filters narrow the grid; empty state: "No previews match these filters."

### 3. Deployments  ·  `screenshots/03-deployments-expanded.png`
**Purpose:** every build-and-start run, with drill-in logs.
- Header: **All statuses** select.
- Stat row (4 cards): Success rate `82%` (green, "73→82" up), Avg duration `1m 18s`, Running now `2` (blue), Failed `2`.
- **Table** in a `--radius-lg` wrap. Sticky header (`--panel-2`, mono uppercase column labels). Columns: Status (badge) · Preview (chevron + "PR #nnn" + project) · Commit (mono, git-commit icon) · Trigger (mono pill `PR_OPENED`/`PR_SYNC`) · Duration (mini bar scaled to max + mono value; running rows show blue "running…") · Queued (mono relative, right-aligned).
- **Row click expands** an inline panel: meta pills (project, repo, PR, trigger) + a **terminal block** (traffic-light dots + `build · <commit>` title + numbered, color-coded log lines whose content varies by status) + action buttons (Open preview, Redeploy, and "View build" for failed). Chevron rotates 90°.

### 4. Builds  ·  `screenshots/04-builds.png`
**Purpose:** triage failed container builds and retry.
- Header: search input ("Filter preview or commit…", real filter) + a "Show all builds" **toggle**.
- Stat row (4): Failed builds `2`, Build success `98%` (green +1.2), Avg build time `1m 09s`, Retries today `3` (blue).
- A summary banner: red `x-octagon` well + "2 failed builds in the last 100 deployments" + subtext.
- **Failed-build cards** (stacked, gap 12). Collapsed row is a 6-col grid: PR + slug + project (chevron) over a branch meta line · mono commit · the **error line** (red chevron + truncated `--red` error text) · mono duration · mono when · "Retry" outline btn.
  - **Expand** reveals a full **terminal log** (traffic-light bar, `build log · <commit> · exit 1`, "FAILED" tag in red, numbered color-coded lines from real tsc/next output) + buttons: "Retry build" (primary), "Open PR" (ghost), "Copy log" (outline).
- Empty state: `No builds match "<q>".`

### 5. Costs  ·  `screenshots/05-costs.png`
**Purpose:** estimated compute spend for the billing month.
- Header: a mono date-range pill "May 31, 2026 → Jun 30, 2026".
- Stat row (3): Total spend `$13.85` (magenta icon, −18% down, magenta spark), Projects with spend `2`, Teams over budget `0` (green, "ok").
- **Two-column** (`1.25fr 1fr`):
  - **Spend over time** panel — an **area chart** (SVG): smoothed magenta line, gradient fill (`--acc` 0.32→0.02), 3 dashed gridlines with `$` axis labels, day labels on X, dot markers. ~230px tall.
  - **Spend by project** panel — **horizontal bars** (`110px name / track / 56px value`): Storefront `$8.24` (magenta), Payments API `$5.61` (teal); axis max `$12`. Footer total `$13.85`.
- **Team budgets** panel — Acme: bold spend `$13.85` / `$750.00`, an 8px magenta gradient meter, mono "1.85% used · healthy" + "$736.15 remaining".
- **By project** table — Project · Active previews · Builds · Estimated (right). Storefront (6, 41, $8.24), Payments API (3, 23, $5.61).

### 6. Projects  ·  `screenshots/06-projects.png`
**Purpose:** connected repos and their preview settings.
- Header: search ("Search projects…", real filter) + sort select (Active/Name/Last updated) + "Connect repo" primary btn.
- **Card grid** `repeat(3,1fr)`. Each `.proj-card`: 38px cube icon well + project name + a "GITHUB" tag (uppercase mono); a github-icon repo meta row; two pills (git-branch `main`, box `Node`/`Next`); a 3-up stat strip bordered top & bottom (active previews / total previews / "last deploy ok" green dot); footer "Updated 1 day ago" + "Manage" ghost btn. Hover lift like preview cards.
- A dashed **"Connect a repository"** CTA card (magenta plus, mono "github · gitlab · bitbucket"); hover tints magenta.
- 2 projects: **Storefront** (`acme/storefront`, main, Next) and **Payments API** (`acme/payments-api`, main, Node).

### 7. Settings  ·  `screenshots/07-settings.png`
**Purpose:** team, members, API access. Title is "Team settings".
- **Two-column** (start-aligned):
  - **Acme** panel (users icon title + OWNER role chip). Key/value rows: Slug `acme`, Monthly budget `$750.00`, Members `4`, Created `Jan 15, 2026, 4:00 AM`, Team ID `team_acme` + a **copy button** (turns green check on copy).
  - **Members** panel (title + "Invite" ghost btn). Rows: 28px gradient initials avatar + name + `@handle` (mono) + role chip (OWNER magenta / MEMBER blue). 4 members.
- **API tokens** panel (key icon title + "Create token" primary btn). Table: Name (key icon + bold) · Prefix (mono `shpyd_ci…`) · Last used · Expires · Actions (trash button, right). Footer note: shield icon + mono "Tokens are shown once at creation. Store them securely."

### Command Palette (global)  ·  `screenshots/08-command-palette.png`
Opened by **⌘K / Ctrl-K** or the topbar search. A centered 620px overlay (`13vh` from top, scrim `rgba(5,6,9,0.62)` + blur). Search input ("Search pages, previews, actions…") + ESC chip. Grouped, filterable results: **Navigation** (7 pages), **Actions** (New preview, Retry failed builds, Create API token, View spend), **Previews** (first 6). Each item: 30px icon well + name + description + a `↵`/`→` key hint. Keyboard: ↑/↓ move selection (selected row gets magenta soft bg + accent icon), Enter activates, Esc closes. Click-outside closes.

---

## Interactions & Behavior
- **Routing:** client-side page state synced to `location.hash` and persisted to `localStorage` (`sy_page`) so a refresh restores the page. Switching scrolls content to top. In the real app, use the router (Next routes / React Router) instead of hash + localStorage.
- **Command palette:** ⌘K/Ctrl-K toggles; full keyboard nav; live substring filter across name+description; selecting a result navigates (and closes).
- **Dropdowns/selects:** click to open, click-outside or Esc to close; checkmark on the active option; selecting updates the filter immediately.
- **Filters that actually work:** Previews (project + status), Deployments (status), Builds (search), Projects (search). Empty states render when nothing matches.
- **Expandable rows:** Deployments rows and Builds cards toggle an inline detail/log; chevron rotates 90°; only one open at a time per list.
- **Copy buttons:** write to clipboard, swap icon to a green check for ~1.3s.
- **Live affordances:** status dots pulse for building/deploying/running (`@keyframes livepulse` / `pulsering`); building/deploying previews show an indeterminate progress bar (`@keyframes indet`); the topbar caret blinks.
- **Hover:** cards lift (`translateY(-2px)` + shadow + stronger border); nav/menu/table rows tint; buttons brighten.
- **Transitions:** 0.12–0.16s on background/border/color/transform throughout. Menus animate in (`menuin`), palette (`cmdin`), pages (`pgin`).
- **Reduced motion / print:** ensure the entrance animation's hidden start state does not leave content invisible — base state should be the visible end state, animating *from* hidden only when motion is allowed.

## State Management
Per-page local state is sufficient for the prototype; in production back the data with your data layer.
- Global: `activePage` (router), `commandPaletteOpen` (boolean), team context.
- Previews: `projectFilter`, `statusFilter`.
- Deployments: `statusFilter`, `expandedRowIndex | null`.
- Builds: `query`, `showAll` (toggle), `expandedIndex | null`.
- Projects: `query`, `sort`.
- Command palette: `query`, `selectedIndex`.
- Copy buttons: transient `copied` boolean.
- **Data fetching (real app):** previews, deployments, builds, cost series, projects, team/members/tokens come from the API. Live states (building/deploying/running, progress, counts) should poll or subscribe (SSE/websocket) so dots, progress bars, and counts update in real time.

## Assets
- **No raster/image assets.** All visuals are CSS + inline SVG.
- **Icons:** the prototype defines stroke icons in `source/icons.jsx` as a name→path map (24×24, `stroke=currentColor`, `fill=none`, `stroke-width 1.75`, round caps). Replace with **lucide-react** (or your icon set). Mapping: grid→`LayoutGrid`, layers→`Layers`, rocket→`Rocket`, terminal→`SquareTerminal`, coin→`CircleDollarSign`, folder→`Folder`/`FolderGit2`, sliders→`SlidersHorizontal`, bell→`Bell`, moon→`Moon`, search→`Search`, external-link→`ExternalLink`, arrow-up-right→`ArrowUpRight`, chevron-down/right→`ChevronDown`/`ChevronRight`, chevrons-up-down→`ChevronsUpDown`, git-commit/branch/pull-request→`GitCommit`/`GitBranch`/`GitPullRequest`, copy→`Copy`, trash→`Trash2`, plus→`Plus`, refresh→`RefreshCw`, check→`Check`, check-circle→`CircleCheck`, alert-circle→`CircleAlert`, x-octagon→`OctagonX`, activity→`Activity`, filter→`Filter`, anchor→`Anchor` (logo), users→`Users`, clock→`Clock`, key→`KeyRound`, shield→`Shield`, trending-up/down→`TrendingUp`/`TrendingDown`, zap→`Zap`, play/stop/pause, cube→`Box`, github→`Github`, globe→`Globe`, command→`Command`.
- **Fonts:** Space Grotesk + JetBrains Mono (Google Fonts). Self-host in production.
- **Charts:** hand-built inline SVG (area chart with Catmull-ish smoothing in `components.jsx → AreaChart`; horizontal bars in `HBars`; sparklines in `Sparkline`). You may keep the SVG math or swap in a chart lib (Recharts/visx) styled to the tokens.

## Files (in `source/`)
- `Shipyard.html` — entry; loads fonts, React 18 + Babel (prototype only), and the scripts below.
- `styles.css` — **the design system** (tokens + every component class). Primary styling reference.
- `data.jsx` — all mock data (previews, deployments, builds, costs, team, members, tokens, notifications, nav, status map). Mirrors the screenshots.
- `icons.jsx` — stroke icon set (`Icon` component).
- `components.jsx` — shared primitives: `StatusBadge`, `Dropdown`, `Select`, `CopyBtn`, `Toggle`, `Sparkline`, `AreaChart`, `HBars`, `Sidebar`, `Topbar`.
- `pages_a.jsx` — Overview, Previews, Deployments (+ `StatCard`).
- `pages_b.jsx` — Builds, Costs, Projects, Settings.
- `app.jsx` — app shell, hash router, command palette, mount.

> To run the reference locally: serve the `source/` folder over HTTP (e.g. `npx serve source`) and open `Shipyard.html` — it needs network access for the React/Babel/Fonts CDNs. Screenshots in `screenshots/` show the intended result.
