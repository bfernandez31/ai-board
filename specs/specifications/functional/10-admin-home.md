# Admin Home Dashboard - Functional Specification

## Purpose

The Admin Home Dashboard at `/admin` is the operator's at-a-glance answer to "is the platform healthy right now?". One scroll-free view surfaces conditional alert banners, four headline KPIs, three business-health panels, three trend charts, and four actionable detail tables — all populated from live platform data.

The dashboard sits inside the same admin shell as [Admin Insights](09-admin-insights.md): the avatar dropdown "Admin" entry navigates here, the "Espace admin" sidebar shows it as **Accueil**, and the same allowlist gate applies — non-allowlisted callers (signed-in or not) receive a Not Found response byte-equivalent to a genuinely missing path.

## Page Layout

The page is composed of five vertical strata, rendered in order:

1. **Alertes** — zero-or-more alert banners above the fold
2. **Pulse** — four KPI tiles side-by-side
3. **Santé Business** — three side-by-side panels (plan donut, activation funnel, churn)
4. **Tendances** — three charts (signups daily, jobs daily stacked, MRR monthly)
5. **Détails actionnables** — four compact tables in a 2×2 grid

Every block degrades gracefully to a friendly empty state if the underlying window has no data; derived percentages render `—` rather than dividing by zero.

## Alerts

The alerts area is empty when the platform is healthy. When an anomaly is detected, one banner per anomaly appears at the top of the page in a deterministic order; each banner carries a contextual action link to the relevant deeper view.

| Alert | Condition | Action link |
|-------|-----------|-------------|
| **Low job success rate** | Trailing 7-day job success rate < 90% **and** at least 20 jobs ran in the same window. The minimum-volume gate prevents the alert from firing during quiet periods. | Failed jobs view |
| **Stripe webhook errors** | One or more Stripe webhook deliveries failed processing in the last 24 hours. | Failed Stripe events |
| **Stale critical cron** | Any cron on the curated critical-cron allowlist has not executed within the last 36 hours. A cron that was registered but has never run is treated the same as a stale cron — the alert fires until the first successful run. | Cron history |

## Pulse — Four KPI Tiles

The Pulse strip displays exactly four tiles. Each tile carries one primary value, two numeric deltas, and a 30-day sparkline.

| Tile | Primary value | Deltas | Sparkline |
|------|---------------|--------|-----------|
| **Users** | Total user count | Trailing 7-day signups; trailing 30-day signups | Daily total users, last 30 days |
| **MAU** | Distinct users who triggered at least one job in the trailing 30 days | Delta vs. the previous trailing 30 days; share of total user base | Daily rolling MAU, last 30 days |
| **MRR** | Sum of monthly contribution for currently active PRO and TEAM subscriptions, annual cadences normalized to a monthly amount | Current calendar-month delta; PRO / TEAM count split | Daily MRR snapshot, last 30 days |
| **Active Paying** | Count of currently paying users (PRO + TEAM) | Trailing 30-day delta; FREE → PAID conversion rate (paying ÷ total) | Daily count, last 30 days |

Trial subscriptions are excluded from MRR. Active Paying counts subscriptions in a billing-system state that represents recurring revenue; past-due and paused states are excluded.

## Santé Business — Three Panels

| Panel | Content |
|-------|---------|
| **Plan distribution donut** | Three segments proportional to the current count of users on each of FREE, PRO, TEAM, with an absolute count next to each segment. A zero-count plan still appears in the legend with a `0` so the operator can confirm the segment exists. |
| **30-day activation funnel** | Four sequential steps measured against the cohort of users who signed up in the trailing 30 days: **Signup → first project created → first job launched → first paid subscription**. The conversion percentage between each consecutive pair of steps is shown; when the prior step is 0, the rate renders `—` rather than dividing by zero. |
| **Current-month churn** | Counts of cancellations and downgrades this calendar month, MRR lost, and net MRR delta for the month. When there are no cancellations, counts and MRR-lost show 0 without errors and the net delta reflects only acquisitions and upgrades. |

Activation steps measure whether each cohort user reached the milestone at any time, not whether the milestone occurred inside the 30-day window.

## Tendances — Three Charts

| Chart | Window | Detail |
|-------|--------|--------|
| **Signups per day** | Trailing 30 days | One data point per day; missing days emit 0 so the series stays length-constant. |
| **Jobs per day, stacked by outcome** | Trailing 30 days | Daily stacked counts of successful vs. failed jobs that sum to total daily jobs. |
| **MRR per month** | Trailing 12 months | One MRR data point per month-end; fewer points if the platform is younger than 12 months. |

## Détails actionnables — 2×2 Grid

| Table | Rows | Columns | Order |
|-------|------|---------|-------|
| **New paying users** | Users who became paying in the last 30 days | Email, current paid plan, account age | Most-recent first |
| **Recent cancellations** | Users who cancelled their subscription in the last 30 days | Email, the lost plan, account age | Most-recent first |
| **Top users** | Up to 5 users with the highest current-month job count | Email, plan, job count | Job count descending |
| **Top projects** | Up to 5 projects with the highest current-month job count | Project key, owner email, job count | Job count descending |

Volume-based rankings (top users, top projects, jobs per day totals) count every job regardless of final status; the dedicated success-vs-fail chart breaks the count down by outcome.

## Auto-refresh

- The page refreshes its data automatically every 30 seconds.
- During an in-flight refresh, the previously rendered data remains visible — no global loading skeleton flashes. Only the first paint shows a loading state.
- If a background refresh fails, the most recent successful data stays on screen and a small unobtrusive indicator signals the failed refresh; the next scheduled refresh is attempted normally.
- Requests do not stack: if a refresh takes longer than 30 seconds, the in-flight request completes before the next one is scheduled.
- Multiple admins viewing the page concurrently each see the same data on their own 30-second cadence; no shared state.

## Empty and degraded states

- **Fresh platform**: every block renders an empty placeholder ("no data yet") rather than an error or a hardcoded number; sparklines render flat; deltas show `—` when there is no prior period to compare to.
- **No signups in 30 days**: the activation funnel shows 0 across all steps and each step's conversion shows `—`.
- **Empty plan segment**: the donut still lists the plan in the legend with a `0`.
- **Cron deployed but never executed**: the stale-cron alert fires (treated as stale) so missing data is visible rather than silent.

## What Is NOT in This Feature

- No user management UI, no per-project drilldown
- No custom date-range pickers — windows (7d, 30d, 12mo, current month) are fixed
- No CSV / report export
- No real-time push from the server — the page is a 30-second poll, nothing else
- No multi-currency display — the MRR values follow the billing system's single currency
