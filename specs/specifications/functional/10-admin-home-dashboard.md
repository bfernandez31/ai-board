# Admin Home Dashboard - Functional Specification

## Purpose

The Admin Home Dashboard is the landing page of the admin area at `/admin`. It condenses platform health into a single operator-facing view organised in five strata, refreshed silently every 30 seconds: an alerts strip, four hero KPI tiles, business-health panels, trend charts, and an actionable 2×2 grid of compact tables. The page is read-only and surfaces account-level identification (email) so operators can decide where to look next.

The dashboard lives inside the shared [admin shell](./09-admin-insights.md#admin-shell) and uses the same allowlist-gated access model: non-admin requests receive the byte-equivalent 404 produced by the canonical admin guard.

## Accessing the Dashboard

`/admin` renders the home dashboard directly. The avatar dropdown's "Admin" entry navigates here, and the admin shell's "Accueil" sidebar item is marked active when the URL path equals `/admin` exactly. Non-admin viewers — including unauthenticated viewers — receive a Not Found response byte-equivalent to a genuinely missing path (status, headers, body). The same byte-equivalent 404 applies to the dashboard's backing API.

## Layout & Strata

The page is a single scrollable column. Sections render top-to-bottom in fixed order so the most important signals are seen first.

### Stratum 1 — Alerts strip

The strip renders **only when at least one alert condition is true**. When the platform is healthy, no container, banner, or placeholder is rendered — silence is the success state.

When at least one alert fires, cards render in a fixed order regardless of trigger order:

1. **Job success rate** — fires when the 7-day rolling job success rate falls below 90%. Computed as `count(jobs in last 7 days with status=COMPLETED) / count(jobs in last 7 days with status IN (COMPLETED, FAILED, CANCELLED))`. The card shows the current percentage and a link to a filtered list of recent failed jobs.
2. **Stripe webhook** — fires when at least one PAID-subscription transition (creation, cancellation, plan change) has been recorded in the database in the last 24 hours **and** no `checkout.session.*`, `customer.subscription.*`, or `invoice.payment_*` Stripe event was recorded in the same window. The card links to a read-only admin view of recent webhook deliveries.
3. **Critical cron(s)** — fires once per cron in the critical list (`nightly-health`, `nightly-log-prune`) whose latest observable success marker is older than 36 hours, or for which no marker exists at all. Each card links to the corresponding GitHub Actions workflow run list, opened in a new tab.

Cards use the project's theme tokens for the warning surface and never collapse below the fold.

### Stratum 2 — Pulse (4 hero KPIs)

Four tiles render left-to-right in this fixed order:

| Tile | Headline value | Deltas | Sparkline |
|------|----------------|--------|-----------|
| **Utilisateurs** (Users) | Total user count | Δ7j (vs. previous 7 days) and Δ30j (vs. previous 30 days) | 30-day new-signups-per-day |
| **MAU** | Users with ≥1 job whose `createdAt` is in the current calendar month (UTC) | Signed delta vs. previous calendar month and `MAU / totalUsers` as a percentage | 30-day distinct-active-users-per-day |
| **MRR estimé** | `(active PRO count × PRO price) + (active TEAM count × TEAM price)` in cents, using the current authoritative plan prices | Signed delta for the current calendar month vs. previous calendar month and a PRO/TEAM split | 30-day estimated MRR per day |
| **Active payants** | Count of subscriptions where `plan IN (PRO, TEAM) AND status = ACTIVE` | Δ30j and the FREE→PAID conversion rate (`active paying / total users`) | 30-day cumulative paying-user count |

Each tile renders exactly two deltas, displayed as signed values (`+N` / `−N` or `+N%` / `−N%`) and colour-coded with theme tokens. Sparklines render exactly 30 data points (one per day for the trailing 30 days) as a small inline visualisation (no axes, ≤ 40 px tall).

The MRR tile's label always contains the word "estimé": the value is computed from current plan prices without proration, discounts, or annual unrolling, and therefore diverges from Stripe-reported MRR by design. The MAU tile exposes its definition ("Users with ≥1 job this month") via tooltip.

### Stratum 3 — Business health

Three structured panels:

- **Plan distribution donut** — three slices (FREE, PRO, TEAM) whose values equal the current database counts of subscriptions per plan. A legend lists each plan name and its absolute count. The slices sum to the total `Subscription` count.
- **30-day activation funnel** — four chronologically ordered steps with both absolute count and conversion rate vs. the previous step:
  1. **Inscriptions** — users created in the last 30 days (cohort denominator).
  2. **1er projet** — cohort users who created at least one project after their signup, within the window.
  3. **1er job** — cohort users whose owned project triggered at least one job after the project creation, within the window.
  4. **Activation payante** — cohort users with at least one `Subscription` where `plan IN (PRO, TEAM) AND status IN (ACTIVE, TRIALING)` activated chronologically after their first job.
  Conversion rate on step 1 is displayed as `—` (not `NaN%`). Step inclusion is strictly chronological: a user counts in step N only if they reached step N-1 before step N.
- **Churn panel** — current calendar month metrics: cancellations count, downgrades count, MRR lost (sum of lost plans' current prices), and net MRR delta (gained − lost).

### Stratum 4 — Trends

Three charts, all using the project's chart tokens:

- **Signups par jour** — last 30 days, one point per day (including zero days). The total over 30 days equals the funnel's signup denominator.
- **Jobs par jour** — last 30 days as a stacked chart: bottom layer is jobs with `status=COMPLETED`, top layer is jobs with `status IN (FAILED, CANCELLED)`.
- **MRR par mois** — last 12 calendar months (oldest left, current right). Each month's value is the estimated MRR at the end of that month, computed with the same formula as the KPI tile (current plan prices applied retroactively — a documented V1 limitation). The current-month bar matches the headline MRR estimé tile's value.

### Stratum 5 — Actionable 2×2 tables

Four compact tables:

| Table | Source | Columns | Sort |
|-------|--------|---------|------|
| **Nouveaux utilisateurs payants 30j** | Subscriptions activated in the last 30 days with `plan IN (PRO, TEAM)` | email, plan, ancienneté (days since activation) | activation date desc, then `userId` asc |
| **Récentes cancellations 30j** | Subscriptions with `canceledAt` within 30 days | email, plan perdu, ancienneté (days since cancellation) | cancellation date desc, then `userId` asc |
| **Top 5 users actifs ce mois** | Users with the highest job count in the current calendar month | email, plan (current effective plan, grace-period aware), job count | job count desc; ties broken by most recent job `createdAt` desc, then `userId` asc |
| **Top 5 projets ce mois** | Projects with the highest job count in the current calendar month | project key, owner email, job count | same tie-break rule as Top users |

30-day tables cap visible rows at 25 most recent and display a count badge `X au total` when the un-capped total exceeds 25. The top-N tables render up to 5 rows. Each table renders an empty-state row when the underlying query returns zero matches.

Tie-breaking is **deterministic and stable**: two consecutive polls of the same data produce byte-identical row orderings.

## Refresh Behaviour

The page polls the dashboard endpoint every 30 seconds with stale-while-revalidate semantics. The first paint shows skeletons; subsequent polls swap data in place without skeletons, scroll-jump, or chart flash. Polling pauses when the browser tab is hidden and resumes on visibility change.

If the dashboard endpoint fails, the page renders a single page-level error banner with a retry button. The previous successful snapshot may remain visible underneath while the banner is displayed.

## Empty & Edge-Case Behaviour

- **Empty database** — every section renders a typed empty state, not a spinner: KPI tiles show 0 with neutral deltas; the donut renders a "no subscriptions yet" placeholder; the funnel shows 4 empty steps; charts render axes with no points; the four tables show empty-state copy.
- **Healthy platform** — the alerts strip is entirely absent. There is no "All systems healthy" banner.
- **Multiple simultaneous alerts** — all triggered alerts render in the fixed order: job-success → Stripe-webhook → cron(s).
- **Very large 30-day lists** — capped at 25 rows with a total-count badge.
- **Zero-cohort funnel** — four step boxes render with 0 / `—` (never `NaN%`).
- **Time windows** — "today", "this month", "last 30 days", "last 7 days" are all computed in UTC; values are displayed with the user's locale formatting.
- **Long-running tab** — polling pauses when the tab is hidden and resumes on visibility change.

## What Is NOT in This Feature

- No drill-through pages from KPI tiles, panels, or table rows (action links on alerts navigate elsewhere; the dashboard itself never opens detail views).
- No filters, date-range pickers, or export buttons. The cap at 25 rows is the V1 contract — no pagination UI.
- No historical price store: the MRR/month chart applies *current* plan prices to past months; a future change to plan prices instantly rewrites historical MRR values.
- No persistence of the snapshot: the payload is recomputed on every request from current database state.
- No notifications, emails, or webhooks triggered by alert state changes — observation is exclusively pull-based via this page.
- No per-user, per-project, or per-tenant partitioning — the dashboard is platform-wide by design.
