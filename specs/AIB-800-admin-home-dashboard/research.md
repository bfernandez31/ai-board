# Phase 0 Research — AIB-800 Admin Home Dashboard

**Feature**: Admin home dashboard with business KPIs and trends
**Branch**: `AIB-800-admin-home-dashboard`
**Status**: Complete — no unresolved NEEDS CLARIFICATION

## Technical Context Resolution

All Technical Context values are inherited from `CLAUDE.md` (TypeScript 5.9 strict, Next.js 16 App Router, Prisma 6.x, PostgreSQL, TanStack Query v5, Recharts 3.x, shadcn/ui, Vitest + Playwright). No new runtime dependencies are introduced. The spec is fully resolved in its `Auto-Resolved Decisions` block and no functional requirement points to an unresolved technical question.

## Existing Files

The dashboard is built **on top of the AIB-796 admin shell**. The existing shell, allowlist guard, sidebar registry, and the `Accueil` sidebar entry are reused as-is. New code is restricted to: the `/admin` page body, KPI / panel / chart / table components under `components/admin/home/`, server-side aggregation queries under `lib/admin/home/`, the supporting API endpoints, two new Prisma models (`WebhookOutcome`, `CronRun`), and two new scheduled workflows for cron timestamp capture.

### Reuse as-is

- `app/admin/layout.tsx:1` — Admin shell layout. Already calls `requireAdminPageOrNotFound`; renders `<AdminShell>{children}</AdminShell>`. **No change.**
- `app/lib/auth/admin.ts:81` — `requireAdminOrNotFound` (API guard) and `requireAdminPageOrNotFound:93` (page guard). Both return the byte-equivalent 404. **Reuse on every new endpoint and on the rewritten `/admin/page.tsx`.**
- `components/admin/admin-shell.tsx:20` — Sidebar + main pane. Already highlights the active item via `isAdminItemActive`. **No change.**
- `components/admin/admin-sidebar-items.ts:18` — `ADMIN_SIDEBAR_ITEMS` already includes `{ id: 'accueil', label: 'Accueil', href: '/admin', icon: Home }`. **No change** — making `/admin` render the dashboard automatically activates this entry.
- `lib/billing/plans.ts:24` — `PLANS` record drives MRR price points (`PRO.priceMonthly = 1500`, `TEAM.priceMonthly = 3000`). **Reuse** for MRR sum and PRO/TEAM split.
- `lib/db/client.ts` — Singleton Prisma client. **Reuse** for every new query.

### Modify (in place)

- `app/admin/page.tsx:1` — Currently a single `redirect('/admin/insights')`. **Replace** with the dashboard server component that fetches initial data (alerts, KPIs, panels, trends, tables) and hydrates a client wrapper.
- `app/api/webhooks/stripe/route.ts:80` — The `switch` block runs handlers inside a `try/catch` that currently logs to console. **Augment**: on success record `WebhookOutcome.SUCCESS`; in the catch record `WebhookOutcome.FAILURE` (with `errorMessage`) before re-throwing/returning 500. The pre-existing idempotency claim via `createStripeEvent` is preserved.
- `prisma/schema.prisma` — Add `WebhookOutcome` model + `WebhookOutcomeStatus` enum, add `CronRun` model + `CriticalCron` enum, add migration. Keep existing models untouched.

### Create new

#### Server / data layer
- `lib/admin/home/alerts.ts` — `computeAlerts()` returns the alert payload (low success rate, Stripe failures, stale cron) by querying `Job`, `WebhookOutcome`, `CronRun`.
- `lib/admin/home/kpis.ts` — `computePulseKpis()`: users + 7d/30d deltas, MAU + delta + share, MRR + month delta + PRO/TEAM split, active paying + 30d delta + FREE→PAID, plus 30-day sparkline series for each tile.
- `lib/admin/home/business.ts` — `computePlanDistribution()`, `computeActivationFunnel()` (30d cohort), `computeChurn()` (current month).
- `lib/admin/home/trends.ts` — `computeSignupsDaily(30)`, `computeJobsDaily(30)` (success/fail stacked), `computeMrrMonthly(12)`.
- `lib/admin/home/tables.ts` — `listNewPayingUsers(30, limit=50)`, `listRecentCancellations(30, limit=50)`, `listTopUsersThisMonth(5)`, `listTopProjectsThisMonth(5)`.
- `lib/admin/home/types.ts` — Shared response shape (`AdminHomeSnapshot`) consumed by the page server component and the polling client query.
- `lib/admin/cron/registry.ts` — `CRITICAL_CRONS` allowlist (typed enum mirror of the Prisma `CriticalCron` enum) and the names/labels/threshold (36h) used by the alert.
- `lib/admin/webhooks/record-outcome.ts` — `recordWebhookOutcome(eventId, type, status, errorMessage?)` — single-row insert; called from `app/api/webhooks/stripe/route.ts`. Failure to record an outcome itself is caught and logged so it never propagates back to Stripe (per spec error-behavior).

#### API
- `app/api/admin/home/route.ts` — `GET` returns the full `AdminHomeSnapshot`. Wrapped in `requireAdminOrNotFound`. Single endpoint per spec to keep the 30-second poll simple and consistent.
- `app/api/maintenance/cron-heartbeat/route.ts` — `POST` with `Authorization: Bearer ${WORKFLOW_API_TOKEN}` records a successful cron run. Body: `{ cron: CriticalCron }`. Used by the new cron heartbeat workflow.

#### Components
- `components/admin/home/admin-home-page.tsx` — Client wrapper. `useQuery({ queryKey: ['admin','home'], refetchInterval: 30_000, staleTime: 25_000, placeholderData: keepPreviousData })`. Renders the four strata.
- `components/admin/home/alert-stack.tsx` — Renders 0..N banners.
- `components/admin/home/pulse-strip.tsx` + `components/admin/home/pulse-tile.tsx` — Four KPI tiles with primary value, two deltas, and Recharts sparkline.
- `components/admin/home/business-row.tsx` — `plan-donut.tsx`, `activation-funnel.tsx`, `churn-panel.tsx`.
- `components/admin/home/trends-row.tsx` — `signups-trend.tsx`, `jobs-trend.tsx`, `mrr-trend.tsx`.
- `components/admin/home/details-grid.tsx` — `new-paying-table.tsx`, `cancellations-table.tsx`, `top-users-table.tsx`, `top-projects-table.tsx`.

#### Workflows / scripts
- `.github/workflows/cron-heartbeat-billing-reconcile.yml` — Replaces or augments any existing billing recon workflow if present; otherwise registers itself as a critical cron and posts to `/api/maintenance/cron-heartbeat` on success.
- `.github/workflows/nightly-log-prune.yml:16` (existing) — Augment final step to POST to `/api/maintenance/cron-heartbeat` after `prune-logs` succeeds.
- `.github/workflows/nightly-health.yml` (existing) — Same heartbeat addition after the SCAN dispatch loop completes with `FAILED=0`.

### Test files (search-existing-first)

- `tests/integration/admin-shell-isolation.test.ts` — Existing. Covers admin allowlist gating on `/admin`. **Extend** with a case that asserts the dashboard renders for admins and 404s for non-admins (so we don't duplicate the gating coverage already in `tests/unit/lib/auth/admin.test.ts`).
- `tests/integration/admin/` — Existing folder (`analysis-workflow.test.ts`, `insights-api.test.ts`, `report-detail.test.ts`, `job-status.test.ts`). **Create new** `home-snapshot.test.ts` for the `GET /api/admin/home` endpoint — separate concern (KPIs/aggregations) from insights tests, so a new file is justified per constitution §III.
- `tests/integration/api/admin/insights/parity-404.test.ts` — Pattern reference for the byte-equivalent 404 test. **Create sibling** `tests/integration/api/admin/home/parity-404.test.ts` for the new endpoint following the exact pattern.
- `tests/integration/webhooks/stripe.test.ts` (if it exists; otherwise create) — Extend or create to assert that successful and failing webhook deliveries each produce one `WebhookOutcome` row.
- `tests/integration/admin/cron-heartbeat.test.ts` — **New file**: covers the `POST /api/maintenance/cron-heartbeat` endpoint (auth header, unknown cron name → 400, valid → 201/200, repeated calls update `lastSuccessAt`).
- `tests/unit/lib/admin/home/kpis.test.ts`, `alerts.test.ts`, `business.test.ts`, `trends.test.ts`, `tables.test.ts` — **New files**, one per aggregator module. Pure-function tests against seeded Prisma rows.
- `tests/unit/components/admin/home/*.test.tsx` — **New folder** mirroring the component folder. RTL tests for empty states, delta formatting, "no data" labels, and the absence of a global skeleton on background refresh.
- `tests/e2e/admin/home-dashboard.spec.ts` — **New** Playwright spec for one golden path only (login as `[e2e]` admin user, land on `/admin`, see four tiles and any conditional banner). E2E is expensive — everything else stays in integration/unit per constitution §III.

## Patterns to Follow

### Admin gating (page + API)

Pattern reference: `app/admin/layout.tsx:14` and `app/lib/auth/admin.ts:81`.

- **Pages**: never call `redirect()` or render an error UI for non-admins. Always call `requireAdminPageOrNotFound(requestLike)` so Next.js produces the framework 404. The dashboard page must follow this even though the layout already calls it — defense in depth and matching the existing `/admin/insights/page.tsx` pattern.
- **API**: every new admin endpoint MUST `return ok.response` from `requireAdminOrNotFound(request)` when `ok === false`. The 404 response body MUST stay empty with `Content-Type: text/html; charset=utf-8` so the existing `parity-404.test.ts` style passes byte-for-byte for the new endpoint too.

### Webhook outcome recording

Pattern reference: `app/api/webhooks/stripe/route.ts:67`–`:106`.

- **Atomic idempotency claim first**: the existing handler inserts `StripeEvent` before any side effects so duplicate deliveries are short-circuited at the unique constraint. New code MUST preserve this ordering — `WebhookOutcome` is recorded *after* the idempotency claim, so a duplicate Stripe redelivery does NOT inflate the failure count.
- **Failure recording in the same try/catch**: the existing `catch (error)` at line 102 logs to `console.error` and returns 500. New code adds a `recordWebhookOutcome(event.id, event.type, 'FAILURE', String(error))` call **inside** the existing catch, before the existing 500 response. If `recordWebhookOutcome` itself throws, the inner call is wrapped in its own try/catch that logs and swallows — the operator must still get a 500 to Stripe so Stripe retries (matches the "fall back to a log" behavior in the spec's `Internal Processes` section).
- **No new transaction boundaries**: the existing handler does not wrap the switch in a Prisma transaction; we keep it that way. `WebhookOutcome` is a separate insert.

### Cron last-run recording

Pattern reference: `.github/workflows/nightly-log-prune.yml:16` (already POSTs to an API route with `WORKFLOW_API_TOKEN`).

- **App owns the timestamp, not the workflow runner**: the heartbeat endpoint receives a `cron` identifier from the registered allowlist and stamps `lastSuccessAt = now()` in Postgres. This matches the existing pattern of API-owned state — the workflow is a dumb caller.
- **Heartbeat AFTER functional work succeeds**: the workflow's last step is the heartbeat POST. If functional steps fail (non-zero exit), the heartbeat step is skipped, so `lastSuccessAt` does NOT advance — this is the behavior the spec demands ("a failed cron run leaves the previous timestamp unchanged").
- **Bearer token auth, not a session**: `Authorization: Bearer ${WORKFLOW_API_TOKEN}` — matches `/api/maintenance/prune-logs`. The endpoint validates this header and returns 401 otherwise, never returns 404.

### TanStack Query polling without skeleton flash

Pattern reference: `components/analytics/analytics-dashboard.tsx:94`.

- **`refetchInterval: 30_000`** (spec FR-026).
- **`staleTime` set just below `refetchInterval` (≈ 25_000)** — same shape as analytics-dashboard's 10_000 against 15_000.
- **`placeholderData: keepPreviousData`** from `@tanstack/react-query` — this is the explicit toggle that satisfies FR-026 / D-9 ("previously rendered data MUST remain visible during the in-flight refresh"). Components MUST consume `data` directly without unmount-on-loading conditionals; the initial-paint loading state is the *only* place a skeleton is allowed (SC-001).
- **Server-rendered initial data passed to the client query as `initialData`** — same pattern as `AnalyticsDashboard({ projectId, initialData })`. The server component fetches `AdminHomeSnapshot` once, ships it as `initialData`, and the client query takes over for the 30-second poll. This means first paint is ready without any client round trip (SC-001 < 3 s).

### Pulse tile sparklines

Pattern reference: `components/analytics/cost-over-time-chart.tsx:36`–`:81`.

- **`ResponsiveContainer` wrapping a Recharts chart** — same shape.
- **`hsl(var(--chart-N))` colors only** — no hex literals. The existing chart uses `--chart-1`; the four Pulse tiles use `--chart-1..4` so each tile reads as visually distinct without violating the "no hardcoded hex" rule in CLAUDE.md.
- **Empty state at the component edge** — `data.length === 0` early-return with `text-muted-foreground` placeholder. FR-029 requires every block render an empty state without errors; sparklines must follow the same `if (data.length === 0) return <EmptyTile/>` shape.

### MRR / churn arithmetic

- **MRR is plan-catalog math, NOT Stripe invoice math** — per spec auto-resolved decision. `computeMrrMonthly` reads active PRO/TEAM subscriptions at each month boundary and sums `PLANS[plan].priceMonthly`. No call to Stripe at request time.
- **"Active" Subscription** for MRR/active-paying counting = `status ∈ {ACTIVE, TRIALING}` AND `plan ∈ {PRO, TEAM}` AND `(cancelAt IS NULL OR cancelAt > now())` — derived from the existing `SubscriptionStatus` enum (`prisma/schema.prisma:395`). `PAST_DUE` is excluded for MRR (matches the edge case in the spec).
- **`canceledAt` is the authoritative cancellation timestamp** — already populated by `handleSubscriptionDeleted` (`route.ts:271`). Churn queries `where: { canceledAt: { gte: startOfMonth } }`.

### MAU / job ranking attribution

- **Jobs have no direct `userId`** — attribution walks `job.ticketId → ticket.projectId → project.userId`. There is no `Job.userId` in `prisma/schema.prisma:29`, so every aggregation must join via Ticket → Project. Confirmed by reading the schema; encoded into `lib/admin/home/kpis.ts` and `tables.ts`.
- **Jobs with `ticketId IS NULL` are project-owned but ticket-less** — they exist (e.g., `comment-*` jobs that fail before ticket binding). For MAU and top-N, fall back to `project.userId` via `projectId`. The aggregation queries MUST cover both shapes.

## Resolved Decisions

| # | Decision | Rationale | Alternatives considered |
|---|----------|-----------|--------------------------|
| R-1 | A single `GET /api/admin/home` returns the full snapshot | Matches the spec's 30-second poll behavior and avoids 12 parallel admin requests on every tick. Easier to keep `placeholderData` consistent across blocks. | Per-block endpoints (`/api/admin/home/kpis`, etc.) — rejected: more network chatter, harder to keep blocks in sync, no caching benefit at 30 s cadence. |
| R-2 | `WebhookOutcome` is a new model, not a flag on `StripeEvent` | `StripeEvent` is the idempotency claim — it exists only for successfully-claimed events. Failures need a separate row whose lifecycle is independent of the claim (we want a row even when claim succeeded but downstream handler failed). | Add `status` enum on `StripeEvent` — rejected: muddles two responsibilities (dedup ledger vs. outcome ledger) and breaks the existing uniqueness contract on `id`. |
| R-3 | `CronRun` is one row per critical cron (`@@unique([cron])`), updated in place | The dashboard only needs `lastSuccessAt`. History is already on GitHub Actions. Single-row-per-cron keeps queries O(1) per cron. | Append-only history table — rejected: adds growth without value for the alert (which only reads the latest). |
| R-4 | Initial critical-cron allowlist: `NIGHTLY_LOG_PRUNE`, `NIGHTLY_HEALTH_SCANS`, `BILLING_RECONCILE` | These are the three scheduled workflows discovered in `.github/workflows/`. `BILLING_RECONCILE` is registered now so the file exists even if the workflow ships separately; missing heartbeats trigger the alert (spec edge case "cron just deployed and never ran"). | Auto-discover from workflow YAML — rejected: spec auto-resolved decision required an explicit allowlist. |
| R-5 | Numeric deltas display `—` when the prior period has no data | Spec edge case for "no signups in last 30 days" explicitly requires "—" instead of NaN/Infinity. Encoded as `formatDelta(current, prior)` helper that returns the em-dash string when `prior === 0 && current === 0`, and a percentage otherwise (zero-prior with non-zero current renders as `+∞ %` is rejected; we render `+{n}` absolute instead). | Show `0%` — rejected: misleads about platform state. |
| R-6 | Tables limit to top-N (FR-024/025) but `new paying` / `cancellations` return up to 50 rows | Spec doesn't cap the recency tables. 50 is large enough for the current customer base, small enough to keep the response payload under ~50 KB per refresh. | No cap — rejected: response payload grows with churn; 30-second polling makes that costly. |
| R-7 | Currency for MRR display: USD, formatted via `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` | `PLANS[].priceMonthly` is already in USD cents (1500 = $15). Existing UI shows USD throughout. | EUR — rejected: not in the price catalog. Multi-currency display — rejected: spec calls for one MRR figure. |
| R-8 | Heartbeat endpoint is `/api/maintenance/cron-heartbeat`, not `/api/admin/...` | The existing `/api/maintenance/prune-logs` already uses this prefix for workflow-token-auth endpoints. Admin endpoints use session auth and would 404 a token-bearing request. | Put under `/api/admin/` — rejected: collides with the admin allowlist guard and confuses the auth model. |

## Testing Strategy (overview — full mapping lives in `plan.md`)

Constitution §III decision tree dictates the bulk of the suite:

- **Pure aggregation helpers** (`lib/admin/home/*.ts`) → Vitest unit tests with seeded Prisma rows (`tests/unit/lib/admin/home/*.test.ts`).
- **`GET /api/admin/home` and `POST /api/maintenance/cron-heartbeat`** → Vitest integration tests in `tests/integration/admin/home-snapshot.test.ts` and `cron-heartbeat.test.ts`.
- **Components** (cards, tables, sparkline empty states, "no flash on refresh") → Vitest + RTL in `tests/unit/components/admin/home/*.test.tsx`. The "no global skeleton" requirement is asserted by rendering with TanStack's `QueryClientProvider`, mutating the cache to simulate a refetch in flight, and asserting the existing tiles remain mounted.
- **`/admin` byte-404 parity** → reuse the existing `parity-404` integration test shape (`tests/integration/api/admin/insights/parity-404.test.ts`) and create a sibling for `home`.
- **One golden-path E2E** in `tests/e2e/admin/home-dashboard.spec.ts` (browser test only justified by the SC-005 promise that values refresh on cadence — the only way to verify "no visible flicker over a real 30-second window" is in a browser).
- **Webhook outcome capture** → extend Stripe webhook integration tests with success / failure paths asserting `WebhookOutcome` rows.

No new dependencies; no constitution gate violations identified.
