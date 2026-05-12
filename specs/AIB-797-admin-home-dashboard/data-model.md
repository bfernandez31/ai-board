# Phase 1 Data Model: AIB-797 Admin home dashboard

**Date**: 2026-05-12 · **Branch**: `AIB-797-admin-home-dashboard`

This feature is overwhelmingly **read-only**: it computes aggregates over existing models (`User`, `Project`, `Job`, `Subscription`, `StripeEvent`). It introduces exactly **one new persisted model** (`CronRunLog`) and several **transient response DTOs** that exist only in the HTTP payload — those are not Prisma entities and never touch the database.

## Persisted entities

### NEW — `CronRunLog`

A small, append-only log of scheduled-workflow success runs. The admin home dashboard reads the latest row per `workflowName` to compute the "critical cron not executed for over 36h" alert (FR-007).

```prisma
model CronRunLog {
  id           Int      @id @default(autoincrement())
  workflowName String   @db.VarChar(100)  // e.g., "nightly-health", "nightly-log-prune"
  ranAt        DateTime @default(now())   // SUCCESS timestamp captured at end of workflow
  durationMs   Int?                       // optional, observational
  runUrl       String?  @db.VarChar(500)  // optional GitHub Actions run URL (full link); the dashboard's deep-link still falls back to the workflow runs-list URL when null

  @@index([workflowName, ranAt])
  @@index([ranAt])
}
```

**Constraints & invariants**:

- `workflowName` is free-form by schema (varchar) but the application's accepted list is hard-coded in `app/lib/admin/home/alerts.ts` (`CRITICAL_CRONS = ['nightly-health', 'nightly-log-prune']`). Adding a cron = code change + corresponding workflow edit; no schema migration needed.
- `ranAt` is set by the **app server** at write time (`@default(now())`) and is the canonical "this cron succeeded" timestamp. The workflow does not send a timestamp — keeps the contract simple and prevents skew between runner clock and DB clock.
- The `runUrl` column is nullable; the alert renders a workflow-runs-list URL even when no marker is present (so the alert link works regardless).
- No `status` column: only successful runs write a marker (per spec §Internal Processes "if the marker write fails, the cron MUST still report success"). A *missing* marker is the implicit failure signal.

**Validation rules** (Zod, in the POST `/api/admin/cron-markers` handler):

```ts
const cronMarkerPostSchema = z.object({
  workflowName: z.string().min(1).max(100),
  durationMs: z.number().int().min(0).max(86_400_000).optional(),  // ≤ 24h
  runUrl: z.string().url().max(500).optional(),
});
```

Zod constraints mirror DB column types per constitution §IV.

**Retention**: lazy delete inside the POST handler — at the end of a successful write, fire-and-forget `prisma.cronRunLog.deleteMany({ where: { ranAt: { lt: cutoff7d } } })`. Bounded table size, no separate cron required. The 7-day window is well beyond the 36h freshness check.

**State transitions**: none. Append-only.

**Migration**: new file `prisma/migrations/<timestamp>_add_cron_run_log/migration.sql` — single `CREATE TABLE` + 2 indexes.

### READ-ONLY — existing models consulted

The aggregator reads from these without modification:

| Model | Fields read | Used for |
|------|-------------|----------|
| `User` | `id`, `email`, `createdAt` | Total user count, signup cohort, "Nouveaux utilisateurs payants" join, top-users rows |
| `Project` | `id`, `key`, `name`, `userId`, `createdAt` | Funnel step 2 (first project), top-projects rows |
| `Job` | `id`, `userId`, `projectId`, `status`, `createdAt` | MAU, top-active-users, top-projects, jobs/day chart, 7-day success rate (alert) |
| `Subscription` | `id`, `userId`, `plan`, `status`, `canceledAt`, `currentPeriodStart`, `createdAt`, `updatedAt` | Plan distribution donut, MRR estimé, active paying, churn panel, "Nouveaux payants" table, "Cancellations" table |
| `StripeEvent` | `id`, `type`, `processedAt` | Stripe-webhook alert proxy (FR-006) |

No new index is required on these models — the dashboard's hottest read path (count subscriptions by status & plan) is covered by existing `Subscription.@@index([status])`; counts by `createdAt` window use sequential scans bounded to 30 days, acceptable at expected scale.

## Transient response DTOs

These are TypeScript interfaces exported from `app/lib/admin/home/types.ts`. They are **never persisted** — they exist only in the JSON payload returned by `GET /api/admin/home`. Spec §Key Entities calls them out as logical entities; here we lock down their shapes.

### `DashboardSnapshot`

The full response from `GET /api/admin/home`.

```ts
export interface DashboardSnapshot {
  generatedAt: string;                // ISO 8601, server time, used by client for "last refreshed"
  alerts: AlertCard[];                // possibly empty — empty array means no alerts
  pulse: {
    users: KpiTile;
    mau: KpiTile;
    mrr: KpiTile;
    paying: KpiTile;
  };
  businessHealth: {
    planDistribution: PlanDistribution;
    activationFunnel: FunnelStep[];   // exactly 4 elements
    churn: ChurnPanel;
  };
  trends: {
    signupsPerDay: DailyPoint[];      // length === 30
    jobsPerDay: JobsDailyPoint[];     // length === 30
    mrrPerMonth: MonthlyPoint[];      // length === 12
  };
  actionable: {
    newPayingUsers: PaidUserRow[];    // capped at 25; meta.total provided
    recentCancellations: CancellationRow[];
    topActiveUsers: TopUserRow[];     // length ≤ 5
    topProjects: TopProjectRow[];     // length ≤ 5
  };
  meta: {
    newPayingUsersTotal: number;
    recentCancellationsTotal: number;
    currencyMinorUnit: 'cents';       // documents the unit of MRR values
  };
}
```

### `AlertCard`

```ts
export type AlertKind = 'job-success' | 'stripe-webhook' | 'cron';

export interface AlertCard {
  kind: AlertKind;
  // Stable client-side key for React lists; for `cron` includes the workflow name.
  id: string;
  payload:
    | { kind: 'job-success'; successRatePct: number; failedCount: number; windowDays: 7 }
    | { kind: 'stripe-webhook'; transitionsInWindow: number; windowHours: 24 }
    | { kind: 'cron'; workflowName: string; lastSuccessAt: string | null; hoursSinceLastSuccess: number | null };
  actionLabel: string;
  actionHref: string;
}
```

**Ordering rule**: the API serializes alerts in the fixed order `job-success → stripe-webhook → cron(s)` (FR-008). Within `cron`, sort by `workflowName` ascending so two adjacent polls produce identical arrays (SC-008 spirit).

### `KpiTile`

```ts
export type KpiId = 'users' | 'mau' | 'mrr' | 'paying';

export interface KpiTile {
  id: KpiId;
  label: string;                       // localized French headline label
  value: number;                       // headline numeric value (count, or MRR in cents)
  unit: 'count' | 'cents' | 'percent'; // for the formatter
  deltas: [Delta, Delta];              // EXACTLY two; tuple type
  sparkline: number[];                 // EXACTLY 30 elements
  tooltip: string;                     // disclosure for ambiguous tiles (e.g., MAU definition)
}

export interface Delta {
  label: string;                       // "Δ7j", "Δ30j", "vs. mois précédent"
  value: number;                       // signed integer or fractional pct
  unit: 'absolute' | 'percent';
  /** Direction for color: 'up' = positive change is good (default), 'down' = positive change is bad. */
  goodDirection: 'up' | 'down';
}
```

**Validation rules**:

- `sparkline.length === 30` (enforced at aggregator level; integration test asserts).
- `deltas` is a tuple of exactly 2; `KpiTile` type enforces it.
- `value` for MRR is in **cents** (minor unit). Client formatter divides by 100. The `unit: 'cents'` tag is the explicit contract.

### `PlanDistribution`

```ts
export interface PlanDistribution {
  free: number;
  pro: number;
  team: number;
}
```

**Invariant** (SC-006): `free + pro + team === total Subscription rows`. Verified by integration test.

### `FunnelStep`

```ts
export type FunnelStepId = 'signups' | 'first_project' | 'first_job' | 'paid';

export interface FunnelStep {
  id: FunnelStepId;
  label: string;
  count: number;
  /** null on step 1 (no previous step), otherwise count/previous. -1 sentinel forbidden. */
  conversionFromPrevious: number | null;
}
```

**Invariant** (FR-017): the array is exactly 4 elements in the order above; each `count` ≤ previous `count` (cohort-monotone — chronological order rule). Tested by `tests/unit/lib/admin/home/dashboard-snapshot.test.ts`.

### `ChurnPanel`

```ts
export interface ChurnPanel {
  cancellationsCount: number;           // subscriptions with canceledAt in current calendar month UTC
  downgradesCount: number;              // transitions to FREE within month (heuristic; see aggregator)
  mrrLostCents: number;                 // sum of plan prices for cancellations+downgrades (current prices)
  netMrrDeltaCents: number;             // gained − lost for the month
}
```

### Trend series points

```ts
export interface DailyPoint {
  date: string;       // 'YYYY-MM-DD' (UTC calendar day)
  value: number;
}

export interface JobsDailyPoint {
  date: string;       // 'YYYY-MM-DD'
  completed: number;
  failed: number;     // FAILED + CANCELLED, per FR-020
}

export interface MonthlyPoint {
  month: string;      // 'YYYY-MM' (UTC calendar month)
  mrrCents: number;
}
```

**Invariants**:

- `signupsPerDay.length === 30`; `jobsPerDay.length === 30`; `mrrPerMonth.length === 12`.
- Every day in the 30-day window is present (zero rows are zero values, not omitted). Same for the 12 months.
- Date order is ascending (oldest first, current last) so chart libs render left-to-right naturally.
- SC-005 reconciliation: `sum(signupsPerDay.value) === activationFunnel[0].count`.
- The current-month MRR bar's value equals the headline MRR estimé tile's `value` (SC-004 spirit).

### Actionable table rows

```ts
export interface PaidUserRow {
  userId: string;
  email: string;          // never null — subscriptions require a User; if email is missing fall back to "(no email)" but log an error
  plan: 'PRO' | 'TEAM';
  activatedAt: string;    // ISO 8601
  daysSinceActivation: number;
}

export interface CancellationRow {
  userId: string;
  email: string;
  lostPlan: 'PRO' | 'TEAM' | 'FREE';   // FREE for explicit-downgrade rows when we surface them
  canceledAt: string;
  daysSinceCancellation: number;
}

export interface TopUserRow {
  userId: string;
  email: string;
  plan: 'FREE' | 'PRO' | 'TEAM';       // current effective plan (cancellations grace-period aware via getEffectivePlan)
  jobCount: number;
  /** Used by the API to enforce tie-breaking; not strictly required by client but documented. */
  lastJobAt: string;
}

export interface TopProjectRow {
  projectId: number;
  projectKey: string;                   // 3-char project key
  projectName: string;
  ownerEmail: string;
  jobCount: number;
  lastJobAt: string;
}
```

**Sort & tie-break rules** (FR-022, SC-008):

- `topActiveUsers`, `topProjects`: primary `jobCount DESC`, secondary `lastJobAt DESC`, tertiary `userId/projectId ASC`. Enforced in the Prisma query's `orderBy` and asserted in `tests/unit/components/admin/home/top-tables.test.tsx`.
- `newPayingUsers`: `activatedAt DESC`, then `userId ASC` as tiebreaker.
- `recentCancellations`: `canceledAt DESC`, then `userId ASC` as tiebreaker.

## State transitions

- `CronRunLog`: append-only. No state machine.
- `DashboardSnapshot`: stateless — recomputed on every request, never cached server-side (the spec explicitly says no persistence; client-side TanStack Query handles `placeholderData`).
- `Subscription`: unchanged. The dashboard only reads transitions, doesn't drive them.

## Relationships

- `CronRunLog`: standalone, no FK. Workflow names are strings keyed by code constants — strong typing happens in TypeScript, not the DB.
- All DTOs are pure data structures: no cross-DTO foreign keys.

## Migration safety checklist (per constitution §V)

- [ ] New `CronRunLog` table is independent (no FK), safe to add without locking existing tables.
- [ ] Indexes (`workflowName, ranAt` and `ranAt`) are small and create instantly.
- [ ] No data backfill required: the first nightly run after deploy writes the first row; until then, the cron alert fires (FALSE-positive once, then self-clears) — acceptable per spec §Internal Processes "false-positive cron not run is acceptable because it surfaces the marker outage too".
- [ ] Migration name follows existing convention `<timestamp>_add_cron_run_log`.
- [ ] No optional fields lacking explicit handling: `durationMs` and `runUrl` are optional but the alert payload tolerates null.
