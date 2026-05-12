# Feature Specification: Admin home dashboard with business KPIs and trends

**Feature Branch**: `AIB-797-admin-home-dashboard`
**Created**: 2026-05-12
**Status**: Draft
**Input**: Ticket AIB-797 — "Admin home dashboard with business KPIs and trends"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Reuse the existing server-side admin allowlist gate (`requireAdminPageOrNotFound` introduced by AIB-791 and consumed by the AIB-796 shell). The new home page MUST be a child of the admin layout so non-admins receive the byte-equivalent 404 with zero leaked markup. No new admin-check helper is introduced.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score +5, sensitive/security signal dominant; ticket says "404 indistinguable")
- **Fallback Triggered?**: No — ticket already requires "404 indistinguable", decision restates and reuses the canonical resolver.
- **Trade-offs**:
  1. The page MUST live under the admin shell layout introduced by AIB-796; ordering risk if that ticket has not merged when this one is built.
  2. Removes any temptation to do an in-page redirect or a parallel `isAdmin` check that could drift from the allowlist.
- **Reviewer Notes**: Verify `app/admin/page.tsx` no longer redirects to `/admin/insights` and instead renders the home dashboard; confirm the byte-equivalent 404 test from AIB-791 still passes for non-admins.

- **Decision**: MRR is computed as **simple plan-price × active-subscription-count**: `(count(Subscription where plan=PRO, status=ACTIVE) × 1500) + (count where plan=TEAM, status=ACTIVE) × 3000)`, in the currency unit defined by `PLANS` (cents/euros minor unit interpretation matches `lib/billing/plans.ts`). No proration, no discount handling, no annual-plan unrolling in V1. The KPI label MUST display the word "estimé" (or "est.") to make the simplification explicit.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score +4, financial accuracy + ticket wording "MRR estimé")
- **Fallback Triggered?**: No — ticket explicitly says "estimé".
- **Trade-offs**:
  1. Will diverge from Stripe-reported MRR if discounts, partial-month upgrades, or trials are in flight; acceptable for V1 because the dashboard is internal and never a source of truth for accounting.
  2. Keeps computation deterministic and unit-testable from DB state alone (no Stripe API call in the hot path).
- **Reviewer Notes**: If Stripe-reported MRR is needed later, this is a separate ticket. Confirm `PLANS.PRO.priceMonthly` and `PLANS.TEAM.priceMonthly` are the authoritative inputs (no hardcoded amounts in the dashboard code).

- **Decision**: MAU = distinct users who created **or were assigned to** at least one `Job` row whose `createdAt` falls in the **current calendar month** (UTC). Job activity is the canonical engagement signal in this system; sign-in counts are not persisted granularly enough to use. The "% de la base totale" displayed beside MAU is `MAU / totalUserCount` for the same instant.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score +3, definitional axis without ticket guidance)
- **Fallback Triggered?**: Yes — ticket says "utilisateurs actifs ce mois" without defining "actif". CONSERVATIVE choice: use Job creation, the strongest engagement signal already persisted, and document the assumption.
- **Trade-offs**:
  1. Users who only browse (no jobs) are not counted. Acceptable for a SaaS where jobs are the unit of value.
  2. Defining MAU on calendar month (not trailing 30 days) makes the delta-vs-previous-month comparison meaningful and aligns with "ce mois" wording.
- **Reviewer Notes**: If product later wants to broaden the definition (sessions, comments, etc.), bump the spec. Until then, the tooltip on the MAU tile MUST disclose "Users with ≥1 job this month".

- **Decision**: The 30-day activation funnel is **cohort-based on signup date**, not current-state. Step inclusion is strictly chronological: a user counts in step *N* only if they reached step *N-1* before step *N*. The cohort is "users with `createdAt` in the last 30 days (rolling window ending now)". The four steps are: (1) Signups (denominator), (2) Created their first project (`Project.userId = user`), (3) Started their first job (`Job` linked to a project they own or are a member of), (4) Activated a PAID subscription (`Subscription.plan IN (PRO, TEAM) AND status IN (ACTIVE, TRIALING)`). Each step's percentage MUST be displayed both as absolute count and as conversion rate from the previous step.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score +4, definitional clarity + business measurability)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Cohort-based funnel is harder to compute than a current-state snapshot but is the only definition that yields meaningful conversion rates.
  2. A 30-day rolling window means the funnel changes day-to-day even for old cohorts that drop out — this is the expected behavior of "funnel d'activation 30j".
- **Reviewer Notes**: Cover the chronological-order rule with a test: a user who paid before creating a project should still only count as paid if they also created a project *before* the payment (otherwise they don't count in step 4 — they're an outlier).

- **Decision**: "Stripe webhook errors not processed in the last 24h" is detected via a new lightweight signal: the dashboard reads from a `StripeEvent`-adjacent surface that captures **delivery attempts that did not result in a successful `StripeEvent` row**. Until that signal is wired up (a separate concern from this ticket), the alert uses the CONSERVATIVE proxy: "no `StripeEvent` of type `checkout.session.completed`, `customer.subscription.*`, or `invoice.payment_*` recorded in the last 24h **while at least one PAID subscription transition existed in DB**." If both conditions hold, raise the alert. The alert links to a server-side admin route that lists raw recent webhook deliveries (read-only).
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score +3, sensitive payments signal but observability is partial)
- **Fallback Triggered?**: Yes — the existing `StripeEvent` table only logs *successful* idempotent processing; failures are not directly persisted today. CONSERVATIVE choice: combine absence-of-events with proof-of-activity to avoid false positives during quiet billing days, and ship the action link to a raw-deliveries view (already needed for triage).
- **Trade-offs**:
  1. Imperfect — a real outage during a quiet billing day might be missed for up to 24h. Acceptable for V1 because Stripe itself retries deliveries for 3 days and pages on its side.
  2. Avoids over-engineering a webhook-failure persistence layer in this ticket; that can come as a follow-up if false-negative rate proves too high.
- **Reviewer Notes**: Document the heuristic clearly in the alert's tooltip; treat the alert as a "look here, something might be off" hint, not a hard incident. Plan an explicit webhook-failure persistence ticket if the heuristic misses real outages.

- **Decision**: "Critical cron not executed for over 36h" applies to the GitHub Actions scheduled workflows `nightly-health.yml` (00:30 UTC) and `nightly-log-prune.yml` (01:15 UTC). Detection is by checking the latest **observable success marker per cron**: nightly-health writes a row this ticket adds (or reuses, if present) to a `CronRunLog`-style surface; nightly-log-prune's marker is the existence of a Blob retention sweep in the last 36h. If no marker is younger than 36h for any tracked cron, raise one alert per missing cron, each with a deep link to the workflow's run list on GitHub.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score +3, reliability signal; mechanism partly new)
- **Fallback Triggered?**: Yes — no canonical cron-run table exists yet; CONSERVATIVE choice picks the smallest persistence surface that lets the alert work, and falls back to per-cron heuristics when a marker is not yet available.
- **Trade-offs**:
  1. Adds a small persistence surface (one record per cron run). Worth it because the alert is otherwise unimplementable.
  2. The list of "critical" crons is hard-coded in V1; that's acceptable and prevents an admin-UI yak-shave.
- **Reviewer Notes**: Confirm during planning that the persistence approach (DB row vs. KV vs. metadata read from GitHub API) is light and that adding a new "critical cron" in the future requires only a code change, not a schema migration. Action link MUST go to the actual GitHub Actions runs list filtered to that workflow.

- **Decision**: The page polls every 30 seconds with **stale-while-revalidate** semantics (TanStack Query `refetchInterval: 30_000`, `staleTime` matching the interval, `placeholderData: keepPreviousData`). The first load shows skeletons; subsequent polls swap data in place with no full re-render flicker. Polling pauses when the tab is hidden (TanStack default) and resumes on visibility change.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score +4, reliability/UX axis + existing project convention)
- **Fallback Triggered?**: No — aligns with CLAUDE.md "client-side polling 15s admin-insights" pattern.
- **Trade-offs**:
  1. 30s polling means N admins create N×2 requests/min; cost is trivial for an admin-only page.
  2. Pausing when hidden saves bandwidth and avoids stale charts spinning indefinitely.
- **Reviewer Notes**: Verify on plan that the dashboard endpoint returns a single consolidated payload (one query per refresh, not 12).

- **Decision**: All KPI tiles, panels, and charts MUST render **a typed empty/zero state, not a loader spinner**, when an input data source is legitimately empty (e.g., 0 jobs this month, 0 cancellations). Loading skeletons only appear on first load. Errors at the API level fall back to a single page-level error banner with a retry button; individual sections do not render half-broken charts.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score +3, UX consistency)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Slightly more presentation code per section, but prevents the "spinner forever" trap when the data is actually empty.
- **Reviewer Notes**: Cover the empty-state path in unit tests for each section.

- **Decision**: "Top 5" tables (top active users this month, top projects this month) MUST tie-break ties deterministically: primary sort = job count desc; secondary sort = most recent job `createdAt` desc; tertiary = entity `id` asc. The "ce mois" window is the current calendar month (UTC), same as MAU, so the page is internally consistent.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score +2, determinism for tests)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Slightly more SQL to write but guarantees the table never reshuffles between two adjacent polls when counts are tied.
- **Reviewer Notes**: Cover tie-breaking with a unit test fixture (two users with the same job count).

- **Decision**: The page is **only one route**: `/admin`. The old redirect from `/admin` to `/admin/insights` (introduced in AIB-791 and preserved by AIB-796 as a temporary measure) MUST be removed in this ticket. `/admin/insights` remains reachable from the sidebar.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score +4, ticket explicitly says "remplace le redirect actuel")
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. None — removal is a single-line edit in `app/admin/page.tsx`.
- **Reviewer Notes**: Confirm AIB-796's spec FR-018 deferral is now satisfied; remove the redirect AND keep the sidebar's "Accueil" item pointing to `/admin`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin operator gets a 5-second pulse on platform health (Priority: P1)

An allowlisted admin opens `/admin` (from the avatar dropdown's "Admin" link, or via the "Accueil" sidebar item once already inside the admin shell). Within five seconds they can read the four hero KPIs (Users, MAU, MRR estimé, Active payants) with deltas and 30-day sparklines, and see at the top of the page whether any operational alert is currently raised. No drilling, no navigation, no clicks required.

**Why this priority**: This is the entire reason the ticket exists — replacing the current `/admin` → `/admin/insights` redirect with a useful landing that condenses platform health into a single glance.

**Independent Test**: With an admin user logged in, navigate to `/admin`. Confirm: (a) the page renders without redirecting elsewhere, (b) four KPI tiles are visible above the fold on a 1366×768 viewport, (c) each tile shows a primary value, two deltas, and a sparkline, (d) the alert strip area is either empty (all healthy) or shows one or more alert cards with action links.

**Acceptance Scenarios**:

1. **Given** an authenticated admin viewer and a database with at least 1 user, 1 project, and 1 job, **When** they navigate to `/admin`, **Then** the page renders the admin shell (from AIB-796) with the "Accueil" sidebar item active and the home dashboard in the main area.
2. **Given** the platform is healthy (job success rate ≥ 90% over 7 days, recent successful Stripe events, all critical crons run within 36h), **When** the page renders, **Then** the alerts strip is not rendered at all (no empty box, no "all good" banner — silence means healthy).
3. **Given** the 7-day rolling job success rate is below 90%, **When** the page renders, **Then** an alert card appears with a label naming the metric, the current percentage, and an action link "Voir les jobs failed" pointing to a filtered list of recent failed jobs.
4. **Given** the four hero KPI tiles, **When** each renders, **Then** it shows: the headline value, exactly two numeric deltas (one short-window, one longer-window, per tile spec), and a 30-day sparkline. No tile shows an unbounded loader after first paint.
5. **Given** the page is open and idle, **When** 30 seconds elapse, **Then** the data is refreshed silently — no full skeleton re-render, no scroll-jump, no chart flash; only values, deltas, and chart points update.

---

### User Story 2 - Admin operator inspects business health and trends (Priority: P1)

The admin scrolls past the KPI strip and reads three structured business panels (plan distribution, 30-day activation funnel, this-month churn) and three trend charts (signups/day 30d, jobs/day 30d split success vs fail, MRR/month 12mo). Each panel/chart presents the data unambiguously and consistently with the rest of the page.

**Why this priority**: Without these two strata, the page is a vanity dashboard. The funnel, churn, and trends are how an operator decides what to investigate.

**Independent Test**: Scroll to each panel. Verify the donut sums to the current total of subscriptions across FREE/PRO/TEAM. Verify the funnel's 4 steps are ordered chronologically and show both absolute counts and conversion rates. Verify the churn panel shows cancellation count, downgrade count, MRR lost, and net MRR delta for the current calendar month. Verify each chart has axes labeled, a 30-day or 12-month x-range, and renders real DB-backed data (no mock).

**Acceptance Scenarios**:

1. **Given** a database with N FREE, P PRO, and T TEAM subscriptions, **When** the plan distribution donut renders, **Then** each slice's count equals the matching DB count and the legend lists FREE/PRO/TEAM with absolute counts.
2. **Given** the 30-day activation funnel, **When** it renders, **Then** the four steps appear in order (Signups → 1st project → 1st job → PAID), each step shows an absolute count and a conversion rate vs. the previous step, and the denominator of the funnel matches the cohort signup count for the last 30 days.
3. **Given** at least one cancellation in the current calendar month, **When** the churn panel renders, **Then** it shows the cancellation count, downgrade count, total MRR lost (sum of plan prices × cancelled+downgraded subscriptions for the month), and the net MRR delta of the month (gained − lost).
4. **Given** the signups-per-day chart, **When** it renders, **Then** the x-axis covers the last 30 days, the y-axis is a count, every day has a bar/point (including zero), and the total over 30 days matches the funnel's signup denominator.
5. **Given** the jobs-per-day chart, **When** it renders, **Then** the chart is stacked (success bottom, fail top), the x-axis covers 30 days, and the totals reconcile with the 7-day job success rate used by the alert when slicing the most recent 7 days.
6. **Given** the MRR-per-month chart, **When** it renders, **Then** the x-axis covers the last 12 calendar months (oldest left, current right), and the current-month bar matches the headline MRR estimé KPI.

---

### User Story 3 - Admin operator drills into actionable lists (Priority: P2)

The admin reaches the bottom 2×2 grid of compact tables: new paying users, recent cancellations, top 5 active users this month, top 5 projects this month. Each table is short (≤5 rows for top-N, capped & paginated implicit-overflow for 30-day lists), email-identifies people directly, and is sorted predictably so two adjacent polls do not reshuffle the order on ties.

**Why this priority**: The strategic strata above ("what changed?") are essential; the actionable strata below ("which accounts to look at?") deepens the page from informational to operational. P2 because the page is still valuable without these tables if they fail to render.

**Independent Test**: Verify each of the four tables: that "new paying users" lists subscriptions activated in the last 30 days (newest first) showing email, plan, ancienneté; "recent cancellations" lists subscriptions cancelled in the last 30 days (most recent first) showing email, plan lost, ancienneté; "top 5 active users" lists 5 users by job count this month, with stable tie-breaking; "top 5 projects" lists 5 projects by job count this month with project key, owner, and count.

**Acceptance Scenarios**:

1. **Given** a database with K paying users activated in the last 30 days, **When** the "Nouveaux utilisateurs payants" table renders, **Then** it lists up to K rows (with an implicit cap if K is huge — see edge cases), each row showing email, plan (PRO|TEAM), and ancienneté (days since activation), sorted by activation date desc.
2. **Given** a database with C cancellations in the last 30 days, **When** the "Récentes cancellations" table renders, **Then** it lists C rows showing email, lost plan, and ancienneté (days since cancellation), sorted by cancellation date desc.
3. **Given** at least 5 users with ≥1 job this calendar month, **When** the "Top 5 users les plus actifs ce mois" table renders, **Then** it shows exactly 5 rows ordered by job count desc, with ties broken deterministically (last job createdAt desc, then user id asc), each row showing email, plan, job count.
4. **Given** at least 5 projects with ≥1 job this calendar month, **When** the "Top 5 projets" table renders, **Then** it shows 5 rows ordered by job count desc with the same tie-breaking, each row showing project key, owner email, job count.
5. **Given** the same window twice within 30 seconds, **When** the page polls, **Then** the table order does NOT spontaneously change for tied rows — tie-breaking is stable across polls.

---

### Edge Cases

- **Empty database** (test/seed environments): every section MUST render an empty state. The four KPI tiles show 0 with neutral deltas; the donut renders a "no subscriptions yet" placeholder; the funnel renders 4 empty steps with 0; the churn panel shows zeros; charts render axes with no points; the four tables show empty-state copy. No spinners stuck.
- **Healthy platform** (no alert conditions met): the alerts strip is entirely absent. There is NO "All systems healthy" banner — silence IS the success state.
- **Multiple simultaneous alerts**: all triggered alerts MUST render, in fixed order: job success rate first, Stripe webhook second, missing cron(s) third (one card per missing cron). The strip uses a fixed warning visual (Aurora-B+ destructive utilities or the equivalent warning tokens) and never collapses below the fold.
- **Very large lists**: "Nouveaux utilisateurs payants" and "Récentes cancellations" over a 30-day window can in principle be hundreds of rows; the table MUST cap visible rows (e.g., 25 most recent) and display a count badge "X au total". V1 does NOT add pagination — the cap is the V1 contract.
- **Currency drift**: MRR is computed from `PLANS.PRO.priceMonthly` and `PLANS.TEAM.priceMonthly`. If these change mid-month, MRR jumps instantly because there is no time-series of historical prices in V1. The MRR/month chart for past months MUST also be computed against the *current* plan prices (lossy but consistent). The MRR label MUST keep the word "estimé" prominent.
- **Cohort smaller than expected**: if the 30-day signup cohort is 0, the funnel still renders four step boxes with 0 / 0% values; conversion rate is displayed as "—" not "NaN%".
- **DST / timezone edge**: all "today", "this month", "last 30 days", "last 7 days" windows are computed in UTC, then displayed with the user's locale formatting. No silent timezone surprises mid-page.
- **Non-admin tries the URL**: `/admin` returns the byte-equivalent 404 enforced by `requireAdminPageOrNotFound`. No leak, no flicker, no partial render.
- **Long-running admin tab**: the page polls every 30s. After 1 hour idle, a TanStack-Query stale check fires; data remains accurate. Pausing on hidden-tab MUST be honored to avoid wasted polls.
- **Page exceeds viewport**: the page is one long scrollable column on smaller monitors; the alert strip and KPI strip MUST remain at top-of-document order so they're seen first.

## Requirements *(mandatory)*

### Functional Requirements

#### Routing & access

- **FR-001**: `/admin` MUST render the home dashboard. The previous redirect to `/admin/insights` (introduced in AIB-791, preserved in AIB-796) MUST be removed.
- **FR-002**: Access is gated by the existing `requireAdminPageOrNotFound` server check inherited from the admin shell layout. Non-admins MUST receive the byte-equivalent 404 contract from AIB-791 with no leaked markup.
- **FR-003**: The home dashboard MUST render inside the AIB-796 admin shell. The "Accueil" sidebar item MUST be visually marked active when on `/admin`.

#### Alerts strip (Stratum 1)

- **FR-004**: An alerts strip MUST render at the very top of the dashboard *only when at least one alert condition is true*. When no alert is active, NO container, banner, or placeholder is rendered.
- **FR-005**: The job-success alert MUST trigger when `(jobs with status=COMPLETED in last 7 days) / (jobs with terminal status [COMPLETED, FAILED, CANCELLED] in last 7 days) < 0.90`. The alert text MUST display the computed percentage and the action link MUST navigate to a filtered list of recent failed jobs.
- **FR-006**: The Stripe-webhook alert MUST trigger when (a) at least one PAID-subscription transition (creation, cancellation, plan change, or `canceledAt`-update) is recorded in the DB within the last 24h AND (b) no `StripeEvent` row with type matching `checkout.session.*`, `customer.subscription.*`, or `invoice.payment_*` exists in the last 24h. The action link MUST navigate to a read-only admin view of the most recent Stripe webhook deliveries.
- **FR-007**: The critical-cron alert MUST trigger when the latest observable success marker for any cron in the critical list (`nightly-health`, `nightly-log-prune`) is older than 36 hours. One alert card is rendered *per missing cron*. Each card's action link MUST navigate to the corresponding GitHub Actions workflow run list (deep link, opens in new tab).
- **FR-008**: Alert cards MUST render in a fixed order regardless of trigger order: job-success → Stripe-webhook → cron(s). Each card MUST visually convey "warning" using existing theme tokens (no hardcoded colors).

#### Pulse — 4 hero KPIs (Stratum 2)

- **FR-009**: The four KPI tiles MUST render in this order, left-to-right: Users (total), MAU, MRR estimé, Active payants.
- **FR-010**: The Users tile MUST display the total user count, a `Δ7d` delta (count of new users in last 7 days vs. count in the preceding 7 days), a `Δ30d` delta (last 30 days vs. preceding 30 days), and a 30-day sparkline of new-signups-per-day.
- **FR-011**: The MAU tile MUST display the MAU count (users with ≥1 job whose `createdAt` is in the current calendar month UTC), a delta vs. the previous calendar month, the `MAU / totalUsers` ratio as a percentage, and a 30-day sparkline of distinct-active-users-per-day.
- **FR-012**: The MRR estimé tile MUST display `(active PRO count × PRO price) + (active TEAM count × TEAM price)` using `PLANS.PRO.priceMonthly` and `PLANS.TEAM.priceMonthly` from `lib/billing/plans.ts`, a delta for the current calendar month vs. previous calendar month, a PRO/TEAM split (two numbers), and a 30-day sparkline of estimated MRR per day. The label MUST contain the word "estimé".
- **FR-013**: The Active payants tile MUST display the count of subscriptions where `plan IN (PRO, TEAM) AND status = ACTIVE`, a `Δ30d` delta, the FREE→PAID conversion rate computed as `(active paying users) / (total users)`, and a 30-day sparkline of cumulative paying-user count.
- **FR-014**: Each KPI tile's two deltas MUST be displayed as signed numeric values (+N / −N or +N% / −N%), color-coded with theme tokens (green for growth in growth metrics, red for shrinkage; reversed for cost/loss metrics), with the comparison window labeled.
- **FR-015**: Each KPI sparkline MUST render exactly 30 data points (one per day for the trailing 30 days). It MUST be a small inline visualization (no axes, no legend, height ≤ 40px) so it sits inside the tile.

#### Business health (Stratum 3)

- **FR-016**: A plan-distribution donut MUST render with three slices (FREE, PRO, TEAM) whose values are the current DB counts of subscriptions per plan. A legend MUST display each plan name and its absolute count.
- **FR-017**: A 30-day activation funnel MUST render four steps, in order, with absolute count and conversion rate vs. previous step displayed for each:
  1. Signups: users created in the last 30 days (cohort denominator).
  2. 1st project: cohort users who created at least one `Project` with `createdAt` ≥ their `User.createdAt` and within the 30-day window.
  3. 1st job: cohort users whose owned project triggered at least one `Job` within the window, chronologically after the project's creation.
  4. PAID: cohort users with at least one `Subscription` where `plan IN (PRO, TEAM) AND status IN (ACTIVE, TRIALING)`, transition occurring chronologically after the 1st job.
- **FR-018**: A churn panel MUST display, for the current calendar month: count of cancellations (`Subscription.canceledAt` in month), count of downgrades (subscription whose plan transitioned to FREE within month), MRR lost (sum of lost plans' `priceMonthly`), and net MRR delta (gained − lost) for the month.

#### Trends (Stratum 4)

- **FR-019**: A "Signups par jour" chart MUST cover the last 30 days, one point per day, y-axis = count of new users created that day. The total over 30 days MUST equal the funnel signup denominator.
- **FR-020**: A "Jobs par jour" chart MUST cover the last 30 days as a stacked chart: bottom layer = jobs with `status=COMPLETED` per day; top layer = jobs with `status IN (FAILED, CANCELLED)` per day. Y-axis = count.
- **FR-021**: An "MRR par mois" chart MUST cover the last 12 calendar months. For each month, the value is the estimated MRR at the end of that month, computed using the same formula as the KPI tile (current plan prices applied retroactively — documented limitation in V1).

#### Actionable details (Stratum 5)

- **FR-022**: A 2×2 grid MUST render four compact tables:
  1. **Nouveaux utilisateurs payants 30j**: subscriptions with `status IN (ACTIVE, TRIALING)` and a transition to PAID (`createdAt` or first PAID activation) within 30 days. Columns: email, plan, ancienneté (days since activation). Sort: activation date desc.
  2. **Récentes cancellations 30j**: subscriptions with `canceledAt` within 30 days. Columns: email, plan perdu, ancienneté (days since cancellation). Sort: cancellation date desc.
  3. **Top 5 users actifs ce mois**: top 5 users by job count this calendar month. Columns: email, plan, job count. Tie-break: most recent job `createdAt` desc, then user id asc.
  4. **Top 5 projets ce mois**: top 5 projects by job count this calendar month. Columns: project key, owner email, job count. Same tie-break rule.
- **FR-023**: Each table MUST render an empty-state row when the underlying query returns zero rows.
- **FR-024**: 30-day tables MUST cap visible rows at 25 most recent and display a count badge of total matching rows when total > 25.

#### Polling, refresh & errors

- **FR-025**: The page MUST refresh its data automatically every 30 seconds, using TanStack Query with `refetchInterval: 30_000` and `placeholderData: keepPreviousData`. Subsequent polls MUST NOT show skeletons or full-section re-renders. Only first-load shows skeletons.
- **FR-026**: Polling MUST pause when the browser tab is hidden (TanStack default `refetchIntervalInBackground: false`) and resume on visibility change.
- **FR-027**: All dashboard data MUST be served by a single consolidated endpoint (or a tightly bounded set) so that one polling tick = one or two HTTP requests, not one per section.
- **FR-028**: If the dashboard endpoint fails (5xx, network error, etc.), a single page-level error banner MUST render with a retry button. Cached last-good data (from the previous successful poll) MAY remain visible underneath.

#### Styling & theme

- **FR-029**: All visuals MUST use existing project tokens: Tailwind semantic colors, Aurora-B+ utilities (`aurora-*`) for cards and panels, shadcn/ui primitives, Lucide icons. No hardcoded hex/rgb. No new color palette.
- **FR-030**: Charts MUST use Recharts 3.x (already in the stack per CLAUDE.md). Stacked, donut, and line/bar primitives are sufficient; no new charting library.
- **FR-031**: The dashboard MUST adapt to light and dark themes — every surface, border, text, and chart axis follows existing theme tokens. No element keeps a fixed color across themes (except where Tailwind palette classes are explicitly allowed for fixed-contrast badges, per CLAUDE.md).

#### Authorization

- **FR-032**: All API endpoints that back the dashboard MUST enforce the admin allowlist server-side (`requireAdminApi` or equivalent existing helper). A non-admin call MUST return 404 (parity with the page), not 401/403 — to prevent existence-leak.
- **FR-033**: All DB queries MUST use Prisma parameterized queries; no raw SQL unless wrapped behind a typed helper with input sanitization.

### Key Entities *(include if feature involves data)*

- **DashboardSnapshot**: The single payload returned by the dashboard endpoint. Contains: alerts (array, possibly empty), pulse (4 KPI structures, each with value+2 deltas+sparkline), businessHealth (donut data, funnel data, churn data), trends (3 series), actionable (4 tables). No persistence — recomputed on every request.
- **AlertCard**: A logical alert entry. Attributes: `kind` (job-success | stripe-webhook | cron), `triggered` (boolean), `payload` (kind-specific numbers shown in the card), `actionLabel`, `actionHref` (where the action button navigates). Not persisted.
- **KpiTile**: A single hero KPI. Attributes: `id` (users|mau|mrr|paying), `value`, `deltas` (array of two), `sparkline` (30 daily points), `tooltip` (definition string shown on hover, e.g., the MAU definition). Not persisted.
- **FunnelStep**: One step in the activation funnel. Attributes: `label`, `count`, `conversionFromPrevious` (null on step 1, percent otherwise).
- **CronMarker**: The latest known success record for a tracked cron. Attributes: `cronId` (string, e.g., `nightly-health`), `lastSuccessAt`, `runUrl`. Sourced from a small new persistence surface (TBD in plan), OR derived from existing artifacts where possible.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Dashboard snapshot computation**: Triggered on every dashboard API call (no schedule, no background job). 
  - **Input**: the authenticated admin's request and the current DB state.
  - **Phases**: (1) admin gate, (2) parallel fan-out queries for each section, (3) compute KPI values, deltas, sparklines, (4) compute funnel cohort, (5) compute churn metrics, (6) format response.
  - **Output**: a single JSON `DashboardSnapshot` payload.
  - **Error behavior**: per-section errors are NOT swallowed — any DB failure MUST surface as a 5xx that the page-level error banner can react to. No partial 200 responses with missing sections in V1.

- **Cron marker persistence** (for nightly-health, nightly-log-prune): triggered by the existing scheduled workflows on each successful run.
  - **Input**: the workflow's run metadata (workflow name, run id, completion timestamp).
  - **Phases**: (1) at end of successful workflow run, POST a small marker payload to an existing internal endpoint (or DB write), (2) old markers older than 7 days may be pruned, (3) the dashboard reads the latest marker per cron when computing the alert condition.
  - **Output**: a single up-to-date marker per tracked cron.
  - **Error behavior**: if the marker write fails inside the cron, the cron itself MUST still report success (the marker is observational, not gating). The dashboard alert will then raise a false-positive "cron not run" — acceptable because it surfaces the marker outage too.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An allowlisted admin landing on `/admin` can read the four hero KPI tiles (values, deltas, sparklines) and check whether any alert is raised in **under 5 seconds** on a typical broadband connection, on first paint of the page.
- **SC-002**: 0% of non-admin sessions can reach the dashboard's URL or its backing API — both return the byte-equivalent 404 contract from AIB-791. Verified by integration test against a non-admin session and the same contract used in AIB-791.
- **SC-003**: When the platform is healthy, **no** alert strip element is present in the DOM (verified by querySelector against a known healthy fixture). When any one of the three alert conditions is true, the corresponding alert is rendered (verified by three separate fixtures, each forcing one condition).
- **SC-004**: The four KPI tile values are computed exclusively from DB state with no mocked values. Cross-checked against direct SQL: total users matches `SELECT COUNT(*) FROM User`; MAU matches `SELECT COUNT(DISTINCT userId) FROM Job WHERE date_trunc('month', createdAt) = date_trunc('month', now())`; MRR matches the formula in FR-012; active paying matches FR-013.
- **SC-005**: The activation funnel's denominator equals the count of users whose `createdAt` is within the last 30 days — verified by reconciling the funnel signup count with the signups-per-day chart's 30-day sum.
- **SC-006**: The donut's three slices sum exactly to `Subscription.count()` (no missing or duplicated subscriptions).
- **SC-007**: The 30-day tables and top-5 tables render correctly on at least three test fixtures: empty DB (empty states), small DB (<5 entities), large DB (>50 entities, validating the 25-row cap).
- **SC-008**: On a stable test fixture, two consecutive polls of the page (30s apart) yield byte-identical table orderings for tied rows — confirming deterministic tie-breaking.
- **SC-009**: Toggling between light and dark themes updates every dashboard element (alerts, KPIs, panels, charts, tables) without any element retaining a fixed color, indicating theme tokens are used throughout.
- **SC-010**: Each polling cycle of the page generates at most 2 HTTP requests to the backend (one snapshot endpoint, optionally one alert-status side-call), verified by network-trace inspection during a 30s window.
- **SC-011**: With the tab in the background for ≥2 minutes, zero polls are issued (verified by trace), and the page resumes polling within 1 second of becoming visible again.
- **SC-012**: Removing the existing `/admin → /admin/insights` redirect does not break `/admin/insights`: it remains reachable from the sidebar's "Insights LLM" item, with no regression to AIB-796's FR-017.
