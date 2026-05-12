# Phase 0 Research: AIB-797 Admin home dashboard

**Date**: 2026-05-12 · **Branch**: `AIB-797-admin-home-dashboard` · **Spec**: `specs/AIB-797-admin-home-dashboard/spec.md`

## Technical Context resolution

All ten Technical Context dimensions resolve to existing project values; no NEEDS CLARIFICATION items remain after the spec's Auto-Resolved Decisions. The only new dependency added is a schema migration (a single new model). See plan.md §Technical Context.

## Existing Files

This inventory is the authoritative reference for "extend vs. create new". Every file path in plan.md and tasks.md must come from this list (or be a justified new file).

### Source — admin shell, auth, routing

| Path | What it covers | Action |
|------|---------------|--------|
| `app/admin/page.tsx` | Currently redirects to `/admin/insights` (FR-001 removes the redirect). | **MODIFY** — replace `redirect(...)` with the home dashboard render (Server Component composing the client `AdminHomeDashboard`). |
| `app/admin/layout.tsx` | Calls `requireAdminPageOrNotFound` and wraps children in `<AdminShell>`. | **Reuse as-is** — no change. The new home page is a child route under this layout. |
| `app/lib/auth/admin.ts` | `requireAdminPageOrNotFound`, `requireAdminOrNotFound`, `adminNotFoundResponse`. | **Reuse as-is** — pattern reference for the new dashboard API. |
| `components/admin/admin-shell.tsx` | Sidebar + main layout, computes `data-active`. | **Reuse as-is** — no change. |
| `components/admin/admin-sidebar-items.ts` | Sidebar definition. "Accueil" already points to `/admin`. | **Reuse as-is** — already correct. |
| `lib/admin/active-path.ts` | `/admin` matches only itself, never claims `/admin/insights`. | **Reuse as-is** — already FR-003-compatible. |
| `app/admin/insights/page.tsx` | Server Component prefetching + pass to client view. | **Pattern reference** for `app/admin/page.tsx`. |
| `components/admin/insights/insights-report-view.tsx` | Client subtree pattern: `'use client'`, `useQuery` with `initialData`, polling cadence, refusal/error placeholders. | **Pattern reference** for `components/admin/home/admin-home-dashboard.tsx`. |
| `app/lib/hooks/queries/use-insights-preflight.ts` | TanStack Query hook with `initialData`, `refetchInterval`, narrow query key tuple. | **Pattern reference** for `use-admin-home-snapshot.ts`. |
| `app/api/admin/insights/preflight/route.ts` | Minimal admin GET route: `requireAdminOrNotFound → compute → NextResponse.json`. | **Pattern reference** for `app/api/admin/home/route.ts`. |

### Source — billing / subscriptions

| Path | What it covers | Action |
|------|---------------|--------|
| `lib/billing/plans.ts` | `PLANS.{FREE,PRO,TEAM}.priceMonthly` (1500 / 3000 cents). | **Reuse as-is** — sole source of plan prices (FR-012 forbids hardcoded amounts). |
| `lib/billing/subscription.ts` | `getUserSubscription`, `getEffectivePlan`. | **Pattern reference** for the "effective paying user" rule. |
| `prisma/schema.prisma` `Subscription` (lines 403–426) | userId unique, `plan`, `status`, `canceledAt`, `currentPeriodStart/End`, `createdAt`, `updatedAt`. | **Read-only** — used by aggregator queries. |
| `prisma/schema.prisma` `StripeEvent` (lines 428–435) | `id`, `type`, `processedAt`, indexed on `(type)` and `(processedAt)`. | **Read-only** — used by the Stripe-webhook alert. |
| `app/api/webhooks/stripe/route.ts` | Records `StripeEvent` rows for idempotency. | **Read-only** — confirms which event types we can pivot on. |

### Source — charts, tiles, UI primitives

| Path | What it covers | Action |
|------|---------------|--------|
| `components/health/sparkline.tsx` | Recharts `LineChart` + `ResponsiveContainer`, height ≤ 40px, semantic tokens. | **Pattern reference** for the KPI tile sparkline (FR-015). |
| `components/analytics/overview-cards.tsx` | KPI grid with `aurora-bg-card-{color}` Card + headline value + delta indicator. | **Pattern reference** for `KpiTile`. |
| `components/analytics/cost-over-time-chart.tsx` | `AreaChart` with empty-state fallback (`text-muted-foreground`) instead of spinner. | **Pattern reference** for "Signups par jour" / "Jobs par jour". |
| `components/analytics/cache-efficiency-chart.tsx` | Recharts `PieChart` (donut variant). | **Pattern reference** for plan-distribution donut (FR-016). |
| `components/analytics/cost-by-stage-chart.tsx` | Stacked bar implementation. | **Pattern reference** for "Jobs par jour" stacked chart (FR-020). |
| `components/ui/card.tsx`, `components/ui/badge.tsx`, `components/ui/skeleton.tsx` | shadcn primitives. | **Reuse as-is**. |
| `app/globals.css` (Aurora utilities lines 629–689) | `.aurora-bg-card-{green,blue,yellow,mauve,pink}`, `.aurora-bg-subtle`, `.aurora-glass`. | **Reuse as-is** (FR-029). |
| `tailwind.config.ts` (semantic tokens + `chart-1..5`) | `text-foreground`, `text-muted-foreground`, `border`, `bg-card`, `--chart-N`. | **Reuse as-is** (FR-031). |

### Source — workflows, cron callback, maintenance

| Path | What it covers | Action |
|------|---------------|--------|
| `.github/workflows/nightly-health.yml` | 00:30 UTC cron, dispatches health scans. | **MODIFY** — append a final step POSTing a success marker. |
| `.github/workflows/nightly-log-prune.yml` | 01:15 UTC cron, calls `/api/maintenance/prune-logs`. | **MODIFY** — append a final step POSTing a success marker. |
| `app/api/maintenance/prune-logs/route.ts` | Uses `verifyWorkflowToken` (Bearer); returns `{prunedCount, skippedCount, durationMs}`. | **Pattern reference** for the new marker endpoint (same auth, same shape). |
| `app/lib/auth/workflow-auth.ts` | `verifyWorkflowToken`, `validateWorkflowAuth`. | **Reuse as-is** — guards the new marker endpoint. |
| `prisma/schema.prisma` (no existing `CronRunLog`) | Confirmed by grep: nothing matches `Cron|RunLog|WorkflowRun`. | **NEW MODEL** required — see data-model.md. |

### Tests — existing files we must extend (NOT duplicate)

| Path | Domain | Action |
|------|--------|--------|
| `tests/unit/components/admin/admin-shell.test.tsx` | Sidebar/active state. | **Extend if** sidebar items change (they do not — FR-003 keeps "Accueil"). Currently no change needed. |
| `tests/integration/admin-shell-isolation.test.ts` | Non-admin can't see admin markup. | **Reuse as-is**. |
| `tests/integration/api/admin/insights/parity-404.test.ts` | Byte-equivalent 404 contract for admin API routes. | **Pattern reference** — create `tests/integration/api/admin/home/parity-404.test.ts` for the new route (new file justified: parity test is route-scoped and per file in existing pattern). |
| `tests/utils/component-test-utils.tsx` (`renderWithProviders`) | QueryClient + Tooltip provider. | **Reuse as-is** — wraps all client component tests. |
| `tests/helpers/db-setup.ts` | `createTestProject`, `createTestTicket`, `createTicketWithJob`. | **Reuse as-is**; extend only if a new fixture (paid subscription, cron marker) is needed by 2+ tests — see plan §Testing Strategy. |

### Tests — new files (no existing coverage)

Justified per "Search existing tests FIRST — extend, don't duplicate" because each new file covers a distinct admin-home domain with no overlap with existing tests:

- `tests/unit/components/admin/home/admin-home-dashboard.test.tsx` — Client orchestrator (loading, empty, error, polling pause-on-hidden).
- `tests/unit/components/admin/home/kpi-tile.test.tsx` — Headline value + 2 deltas + sparkline.
- `tests/unit/components/admin/home/alerts-strip.test.tsx` — Fixed ordering, conditional render (FR-004/SC-003), hardcoded "no banner when healthy".
- `tests/unit/components/admin/home/activation-funnel.test.tsx` — 4 steps, chronological cohort rule, "—" instead of "NaN%".
- `tests/unit/components/admin/home/top-tables.test.tsx` — Tie-breaking determinism (SC-008), empty state, 25-row cap badge.
- `tests/unit/lib/admin/home/dashboard-snapshot.test.ts` — Pure aggregator: MRR formula (FR-012), MAU rule (FR-011), funnel cohort chronology, churn formula. All against an in-memory fixture (no DB).
- `tests/integration/api/admin/home/snapshot.test.ts` — End-to-end DB scenarios: empty DB, small DB, large DB, three alert conditions individually.
- `tests/integration/api/admin/home/parity-404.test.ts` — Byte-equivalent 404 for non-admins (mirrors `insights/parity-404.test.ts`).
- `tests/integration/api/admin/cron-markers/post.test.ts` — Marker endpoint auth (workflow token required) + idempotency on repeated writes.

No E2E required: the alert/KPI/funnel rendering is fully testable in integration; navigation from sidebar to `/admin` is already covered by AIB-796's tests; the byte-equivalent 404 is asserted in the parity integration test.

## Patterns to Follow

These are concrete, line-anchored patterns the new code MUST follow. Loose references like "follow existing patterns" are insufficient per /plan rules.

### P1 — Server Component data fetch → Client subtree for polling

**Reference**: `app/admin/insights/page.tsx:13-35`

```tsx
export default async function InsightsPage() {
  await reconcileOrphanedRunningReports(new Date());  // pre-step that MUST run server-side
  const reports = await listReports(200);
  const preflight = await computePreflightSnapshot();
  return <InsightsReportView reports={...} latest={...} preflight={preflight} />;
}
```

**Apply to `app/admin/page.tsx`**: compute one full `DashboardSnapshot` server-side via `computeDashboardSnapshot()` and pass it as `initialData` to the client component. This ensures first paint shows real numbers (SC-001 ≤ 5s), not skeletons.

### P2 — Admin API route guard

**Reference**: `app/api/admin/insights/preflight/route.ts:13-19`

```ts
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireAdminOrNotFound(request);
  if (!auth.ok) return auth.response;            // byte-equivalent 404
  const snapshot = await computePreflightSnapshot();
  return NextResponse.json(snapshot);
}
```

**Apply to `app/api/admin/home/route.ts`**: identical shape — `requireAdminOrNotFound → if (!auth.ok) return auth.response → computeDashboardSnapshot → NextResponse.json`. **No 401/403** — non-admins see the same 404 as a missing route (FR-002, FR-032, SC-002). Cover with `parity-404.test.ts` mirroring `insights/parity-404.test.ts:30-83`.

### P3 — TanStack Query polling with SSR initialData

**Reference**: `app/lib/hooks/queries/use-insights-preflight.ts:25-45`

Pattern: narrow `as const` query key tuple, `initialData` parameter from caller, `refetchInterval` numeric or `false`, `staleTime: 0` so refetch is decisive on focus. `refetchIntervalInBackground` is left at its default `false` so polling pauses when the tab is hidden (FR-026, SC-011).

**Apply to `use-admin-home-snapshot.ts`**:

```ts
return useQuery({
  queryKey: ['admin', 'home', 'snapshot'] as const,
  queryFn: async (): Promise<DashboardSnapshot> => { /* fetch /api/admin/home */ },
  initialData,
  refetchInterval: 30_000,
  staleTime: 30_000,
  placeholderData: keepPreviousData,   // FR-025 — swap-in-place, no skeleton
});
```

### P4 — Workflow-token auth for cron callbacks

**Reference**: `app/api/maintenance/prune-logs/route.ts:10-13`

```ts
if (!(await verifyWorkflowToken(request))) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Apply to `app/api/admin/cron-markers/route.ts`** (the new marker write endpoint called from workflows): same Bearer-token guard. **Security note**: this endpoint is called *by GitHub Actions only*, never by the browser. Returning 401 (not 404) is correct here because the workflow-token contract is the same as every other workflow-to-app callback (`PATCH /api/jobs/:id/status`, etc.). The read side (`GET /api/admin/home`) uses the admin-page 404 contract (P2).

### P5 — Atomic DB upsert for marker write (state management)

**Reference**: `app/api/webhooks/stripe/route.ts:71` (the `createStripeEvent` idempotency upsert) — single `prisma.stripeEvent.create` inside the webhook handler; unique constraint prevents double-processing.

**Apply to cron-marker write**: use `prisma.cronRunLog.create({ data: ... })` with `workflowName`-indexed reads; do NOT upsert by `workflowName` alone — keep the history of runs so we can reason about gaps. The dashboard reads `prisma.cronRunLog.findFirst({ where: { workflowName }, orderBy: { ranAt: 'desc' } })`. Pruning rows older than 7 days happens lazily inside the same marker endpoint (cheap delete-many) per spec §Internal Processes.

### P6 — Error propagation across DB mutations (constitution §V)

**Reference**: Constitution §V "If an external call (workflow dispatch, API) fails after a DB mutation, the database state must remain consistent (no orphaned PENDING rows, no success returned to caller)."

**Apply to `/api/admin/home`**: each DB query in the aggregator is read-only, so there's no mutation rollback concern. If any sub-query throws, the route MUST surface a 5xx (FR-028 — the page-level error banner reacts to it). DO NOT swallow per-section errors and return a partial 200; that violates constitution §III (assertions hidden in conditional branches) and FR §"per-section errors are NOT swallowed".

### P7 — Empty state instead of spinner (FR + reference)

**Reference**: `components/analytics/cost-over-time-chart.tsx:13-26` returns a Card with centered muted text when `data.length === 0` — not a Skeleton.

**Apply to every section** of the dashboard: when the underlying query yields zero rows, render a typed empty state with neutral copy. Skeletons appear ONLY on first load before `initialData` resolves (FR-025); subsequent polls keep showing the last-good data (P3 `placeholderData: keepPreviousData`).

### P8 — Recharts color via CSS variables (theme adaptivity)

**Reference**: all `/components/analytics/*-chart.tsx` use `stroke="hsl(var(--chart-1))"`, `fill="hsl(var(--chart-2))"` etc. Never hex literals.

**Apply to all new charts**: use `hsl(var(--chart-N))` for series colors, `hsl(var(--muted-foreground))` for axes/labels. Verified via `components/health/sparkline.tsx:8-27`. This satisfies FR-029, FR-031, SC-009.

### P9 — Sidebar active state already correct

**Reference**: `lib/admin/active-path.ts:1-8`. `/admin` matches only itself (carve-out for the home page); it never claims `/admin/insights`.

**Implication**: zero changes to sidebar code or `active-path.ts` are needed. The home page going live just causes the existing "Accueil" item to highlight on `/admin` instead of pointing nowhere useful (FR-003). No regression risk to AIB-796.

## Consolidated Decisions

For each spec-level open question (Technical Context), one Decision / Rationale / Alternatives bullet:

- **Decision**: Single consolidated endpoint `GET /api/admin/home` returns the entire `DashboardSnapshot` (alerts, pulse, businessHealth, trends, actionable). **Rationale**: FR-027 + SC-010 cap polling at ≤2 HTTP req per cycle; one endpoint is the simplest way to honor that. **Alternatives**: per-section endpoints (rejected: 12+ requests, harder cache, more places to add admin gate); GraphQL (rejected: not in stack).

- **Decision**: Aggregator module at `app/lib/admin/home/dashboard-snapshot.ts` orchestrates parallel Prisma queries via `Promise.all`. **Rationale**: keeps the route file thin (P2 pattern) and lets the aggregator be unit-testable against an in-memory fixture. **Alternatives**: inline queries in `route.ts` (rejected: untestable without DB); per-section folder of helpers (rejected: yak-shave, no reuse outside this page).

- **Decision**: New Prisma model `CronRunLog { id, workflowName, ranAt, durationMs?, runUrl? }` with `@@index([workflowName, ranAt])`. **Rationale**: spec §Internal Processes requires a marker; no existing surface fits; one record per cron run keeps the table tiny (~365×N/year for N tracked crons). **Alternatives**: upsert one row per workflow (rejected: loses history needed for the 36h freshness check on a quiet day); GitHub API read (rejected: requires PAT, latency, rate limits); KV store (rejected: not in stack).

- **Decision**: Hard-code the list of critical crons in code (`CRITICAL_CRONS = ['nightly-health', 'nightly-log-prune']`) inside `app/lib/admin/home/alerts.ts`. **Rationale**: spec §"Critical cron" reviewer note explicitly OKs hard-coding for V1 and says adding a new cron should require code change only. **Alternatives**: env var (rejected: deploy-coupled config, harder to test); admin UI (rejected: yak-shave per spec).

- **Decision**: MRR units are interpreted as **cents** (matching `lib/billing/plans.ts` where PRO=1500, TEAM=3000), displayed to the operator as the matching whole currency unit (1500 cents → "€15" / "$15") via a small `formatPriceMonthly` helper that divides by 100. **Rationale**: prevents accidental 100× scaling drift; aligns with Stripe conventions. **Alternatives**: store euros (rejected: would require touching `lib/billing/plans.ts`, out of scope).

- **Decision**: All windowed queries (last 7 days, last 30 days, current calendar month) compute the bound in JavaScript (`new Date()` + UTC normalization) and pass the resulting `Date` to Prisma. **Rationale**: keeps SQL simple, avoids DB-driver timezone surprises, FR-033 forbids raw SQL. The `date_trunc('month', ...)` formula in SC-004 is exposition; we implement it equivalently in TS. **Alternatives**: `$queryRaw` (rejected by FR-033); `date-fns-tz` (rejected: not in stack; UTC math is trivial enough).

- **Decision**: Sparkline data is computed once per snapshot (4 small arrays of 30 numbers), embedded in the response. **Rationale**: keeps the page to one network round-trip (FR-027); the data is tiny (120 numbers). **Alternatives**: separate sparkline endpoint (rejected: violates SC-010); compute client-side (rejected: client cannot run Prisma).

- **Decision**: Cron marker callback endpoint is POST `/api/admin/cron-markers` (workflow-token Bearer auth; route lives under `/api/admin/` for clarity even though the auth differs from the read side). **Rationale**: keeps all admin-home surface area grouped; `verifyWorkflowToken` is the right guard for workflow callers; the existing `/api/admin/insights/*` endpoints already mix `requireAdminOrNotFound`-gated reads with workflow-only writes in the same namespace. **Alternatives**: `/api/maintenance/cron-markers` (rejected: only `prune-logs` is "maintenance"; markers are observational); embed marker write in each workflow's existing terminal callback (rejected: nightly-health and nightly-log-prune don't currently have job-level callbacks).

- **Decision**: Cron marker write is **non-blocking** for the cron itself — the marker POST runs as the workflow's last step with `continue-on-error: true`. **Rationale**: spec explicitly notes "if the marker write fails inside the cron, the cron itself MUST still report success". **Alternatives**: fail the cron on marker failure (rejected: would convert observational signal into operational risk).

- **Decision**: GitHub Actions deep link for the cron alert is constructed at render time from the workflow file name: `https://github.com/${owner}/${repo}/actions/workflows/${workflowName}.yml`. The owner/repo are read from `process.env.GITHUB_REPOSITORY` (always set in Vercel + dev) or a small fallback constant. **Rationale**: spec §FR-007 requires the link; storing `runUrl` per marker is wasteful when only "workflow runs list" is needed. **Alternatives**: store `runUrl` per marker (rejected: doubles row size for a link we can derive).

## What's NOT in scope (deferred to follow-ups)

- Persistence of Stripe-webhook delivery failures (the alert uses the CONSERVATIVE proxy described in spec §Auto-Resolved). A dedicated webhook-failure ticket is the right place.
- Pagination on the 30-day tables — capped at 25 rows + a "X au total" badge per FR-024.
- Historical plan-price time-series for retroactive MRR — the 12-month MRR chart uses current plan prices applied retroactively; documented as a V1 limitation.
- Stripe API live reads for MRR cross-check — out of scope; FR-012 computes MRR purely from DB.

## Open risks / sequencing notes

- **AIB-796 dependency**: this page MUST render inside the admin shell from AIB-796 (`app/admin/layout.tsx` exists and works). Confirmed merged (`be7228ac` and `5fd7fdbf` in `git log`). Safe to proceed.
- **CronRunLog migration timing**: the new migration MUST land before the workflow YAML edits go live in production, or the first nightly run will hit a 404. Mitigated by `continue-on-error: true` (P9 / spec §Internal Processes).
- **Stripe webhook alert false positives**: on a genuinely quiet billing day (no transitions), the alert's "AND" guard prevents firing. On a half-quiet day (one transition, then webhook failure), the alert fires within 24h; acceptable per spec.
