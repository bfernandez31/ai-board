# Phase 1 Data Model — AIB-800 Admin Home Dashboard

## Overview

Two **new persisted models** are required: `WebhookOutcome` (for the Stripe-error alert) and `CronRun` (for the stale-cron alert). Two **new enums** support them: `WebhookOutcomeStatus` and `CriticalCron`. All other entities consumed by the dashboard already exist and are read-only from this feature's perspective; their relevant fields are listed below for traceability.

## New persisted entities

### `WebhookOutcome`

A row per inbound Stripe webhook delivery, written by `app/api/webhooks/stripe/route.ts` after the idempotency claim succeeds.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `Int @id @default(autoincrement())` | Surrogate primary key. |
| `provider` | `String @db.VarChar(50)` | Hard-coded `"stripe"` for this release; the column is generic so future providers (PayPal, etc.) can share the table without a migration. |
| `eventId` | `String @db.VarChar(255)` | Stripe event id (`evt_...`). NOT unique — a redelivery that is short-circuited at the `StripeEvent` unique constraint never reaches this row, so a single event will never produce two outcome rows under normal operation. |
| `eventType` | `String @db.VarChar(100)` | Stripe event type, e.g. `invoice.payment_failed`. |
| `status` | `WebhookOutcomeStatus` | `SUCCESS \| FAILURE`. |
| `errorMessage` | `String? @db.VarChar(1000)` | Truncated `String(error)` from the catch block. `null` for SUCCESS. |
| `receivedAt` | `DateTime @default(now())` | Insert timestamp; also the value the dashboard's 24-hour window is computed against. |

**Indexes**
- `@@index([status, receivedAt])` — drives the alert query `count where status=FAILURE and receivedAt >= now() - 24h`.
- `@@index([provider, receivedAt])` — keeps the table indexable when other providers are added later.

**Validation rules (Zod schema co-located with `recordWebhookOutcome`)**
- `provider`: `z.literal('stripe')` for this release.
- `eventId`: non-empty, max 255 chars.
- `eventType`: non-empty, max 100 chars.
- `status`: enum.
- `errorMessage`: optional string, max 1000 chars; must be `undefined` when `status === 'SUCCESS'`.

**Retention** — not pruned by this feature. The alert window is 24 h; rows beyond that are inert until a separate maintenance task evicts them. Spec §`Internal Processes` says "older records may be pruned per existing retention practice" — a follow-up ticket can wire this into `nightly-log-prune` if needed.

### `WebhookOutcomeStatus` enum

```
enum WebhookOutcomeStatus {
  SUCCESS
  FAILURE
}
```

Note: spec mentions "retries exhausted" as a separate outcome. Stripe does not emit a distinct webhook for "retries exhausted" — what the operator sees is N failed deliveries for the same `event.id`, each producing one FAILURE row. The dashboard alert reads "1+ FAILURE in 24 h", which already covers the retries-exhausted case without a third enum value.

### `CronRun`

One row per critical cron, updated in place by `POST /api/maintenance/cron-heartbeat`. Created on first heartbeat (upsert), never deleted.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `Int @id @default(autoincrement())` | Surrogate primary key. |
| `cron` | `CriticalCron @unique` | Enum identifying the registered cron. `@unique` enforces R-3 (one row per cron). |
| `lastSuccessAt` | `DateTime` | Last successful heartbeat timestamp. Required — the heartbeat endpoint always sets this. |
| `updatedAt` | `DateTime @updatedAt` | Bookkeeping. |

**Indexes** — none beyond the unique. The alert query selects all rows and checks `lastSuccessAt < now() - 36h`; the table has one row per registered cron (currently 3), so a full scan is constant.

**Validation rules**
- `cron`: must be a valid `CriticalCron` enum value; the heartbeat endpoint returns 400 on unknown values.

### `CriticalCron` enum

```
enum CriticalCron {
  NIGHTLY_LOG_PRUNE
  NIGHTLY_HEALTH_SCANS
  BILLING_RECONCILE
}
```

The TypeScript-side allowlist (`lib/admin/cron/registry.ts`) mirrors this enum with `{ key, label, thresholdHours }` so the UI can render human-readable names without depending on the enum string.

### Migration shape

```
prisma/migrations/<timestamp>_aib800_admin_home_dashboard/
  migration.sql
```

The migration:
1. Creates the two enums (`WebhookOutcomeStatus`, `CriticalCron`).
2. Creates the two tables and their indexes.
3. Does NOT seed `CronRun` rows — the first heartbeat upserts them. The stale-cron alert will fire for any registered critical cron that has never heart-beat, which is the intended behavior (spec edge case "cron just deployed and never ran").

## Read-only entities the dashboard consumes

All of these already exist in `prisma/schema.prisma`. The dashboard's aggregation queries read fields listed here; no schema change is required for any of them.

### `User` (`prisma/schema.prisma:219`)
- `id`, `email`, `createdAt`
- Relation: `subscription` (1:1), `projects`
- **Used by**: total user count (KPI), 7d/30d signup deltas, signup sparkline, signup trend chart, activation funnel cohort denominator, new-paying / cancellations tables (`User.email`), top-users table (`User.email`).

### `Subscription` (`prisma/schema.prisma:403`)
- `userId`, `plan` (`FREE`|`PRO`|`TEAM`), `status` (`ACTIVE`|`TRIALING`|`PAST_DUE`|`CANCELED`|`INCOMPLETE`), `currentPeriodStart`, `currentPeriodEnd`, `canceledAt`, `cancelAt`, `createdAt`, `updatedAt`
- **Used by**: MRR (sum of `priceMonthly` over `status ∈ {ACTIVE, TRIALING}` AND `plan ∈ {PRO, TEAM}` AND `(cancelAt IS NULL OR cancelAt > now())`), MRR per month for the 12-month trend (re-evaluated at each month boundary), plan-distribution donut (current `plan` per user), active-paying KPI + 30d delta, churn panel (cancellations / downgrades / MRR lost / net delta for the current calendar month), activation funnel step 4 (first paid subscription), new-paying / cancellations tables.

**Downgrade detection** for the churn panel: a downgrade is a Subscription whose `plan` changed to a less-expensive plan within the current calendar month. The Subscription model does not retain history — we infer downgrade from `updatedAt` and the price catalog by comparing `stripePriceId` against the catalog at the time of the snapshot. **Edge**: If a user upgraded then downgraded within the same month, only the most recent state is visible. The churn panel's count of downgrades is therefore an approximation; this is acceptable per the spec which does not require full subscription history.

### `Job` (`prisma/schema.prisma:29`)
- `id`, `ticketId` (nullable), `projectId`, `command`, `status` (`PENDING`|`RUNNING`|`COMPLETED`|`FAILED`|`CANCELLED`), `startedAt`, `completedAt`, `createdAt`
- **Used by**: 7-day job success rate alert (denominator: `status ∈ {COMPLETED, FAILED}` in the trailing 7d; numerator: `status = COMPLETED`; alert fires when ratio < 0.9 AND denominator >= 20), MAU (distinct `project.userId` of jobs in trailing 30d), jobs-per-day trend (30d, stacked success vs. fail), top-users / top-projects tables (current calendar month grouping by user/project, ordered by job count desc, limit 5). CANCELLED jobs are counted in volume rankings per the spec's auto-resolved decision.

### `Project` (`prisma/schema.prisma:112`)
- `id`, `key`, `userId`, `name`
- **Used by**: top-projects table (project key + owner email + job count).

### `Ticket` (`prisma/schema.prisma:175`)
- `projectId`
- **Used by**: MAU / top-N attribution — `Job → Ticket → Project → User`. Jobs with `ticketId IS NULL` fall back to `Job.projectId`.

### `StripeEvent` (`prisma/schema.prisma:428`)
- No change. The dashboard does NOT read this model — it reads `WebhookOutcome` for the failure alert.

## Derived KPI calculations (canonical formulas)

These are the exact formulas the aggregation helpers in `lib/admin/home/` MUST implement. Every spec auto-resolved decision and every FR maps to a row here.

| Metric | Definition | SQL/Prisma sketch |
|--------|------------|--------------------|
| Total users | `count(User)` | `prisma.user.count()` |
| Users 7d delta | `count(User where createdAt >= now()-7d)` | `prisma.user.count({ where: { createdAt: { gte: minus7d } } })` |
| Users 30d delta | `count(User where createdAt >= now()-30d)` | same with 30d. |
| MAU | `count(distinct project.userId from Job where startedAt >= now()-30d)` | `prisma.job.findMany({ where: { startedAt: { gte: minus30d } }, select: { project: { select: { userId: true } } } })` then dedupe in app code. |
| MAU prev-30d delta | `currentMAU − previousMAU` over equal-width windows. | Two queries; same shape, different windows. |
| MAU % of base | `MAU / totalUsers`; render `—` when totalUsers === 0. | App-side. |
| MRR (now) | `sum(PLANS[sub.plan].priceMonthly for sub where status ∈ {ACTIVE,TRIALING} AND plan ∈ {PRO,TEAM} AND (cancelAt IS NULL OR cancelAt > now()))` | `prisma.subscription.findMany({ where: { status: { in: ['ACTIVE','TRIALING'] }, plan: { in: ['PRO','TEAM'] }, OR: [{ cancelAt: null }, { cancelAt: { gt: now } }] } })` |
| MRR month delta | `MRR(now) − MRR(startOfMonth)`; the latter is reconstructed by replaying `Subscription.canceledAt`/`createdAt`/`updatedAt` against the catalog — full historical reconstruction is out of scope, so we compute it as `(sum of priceMonthly for subs that became active this month) − (sum for subs that canceled this month)` — i.e. net delta = acquisitions + upgrades − cancellations − downgrades for the current calendar month. | See `lib/admin/home/business.ts:computeChurn` + `kpis.ts:computeMrrDelta`. |
| MRR PRO/TEAM split | Two sums grouped by `plan`. | `groupBy({ by: ['plan'], where: ... , _count: true })` then multiply by catalog. |
| Active paying | `count(Subscription where status ∈ {ACTIVE,TRIALING} AND plan ∈ {PRO,TEAM} AND (cancelAt IS NULL OR cancelAt > now()))`. | Same `where` as MRR. |
| Active paying 30d delta | Window-over-window: `currentActivePaying − activePaying30dAgo`. The 30-days-ago value is approximated as `currentActivePaying − count(subs that became paying within last 30d) + count(subs that lost paid status within last 30d)`. | App-side computation against the same subscription rows. |
| FREE→PAID conversion | `activePaying / totalUsers`. | App-side. |
| Plan distribution | `groupBy({ by: ['plan'], where: { user: { ... } }, _count: true })` from User joined to Subscription (FREE = users with no Subscription OR Subscription.plan = FREE). | App-side merge. |
| Activation funnel | Cohort: `User.createdAt >= now()-30d`. Step 2: cohort users with at least one `Project`. Step 3: cohort users whose projects have at least one `Job`. Step 4: cohort users with `Subscription where plan ∈ {PRO,TEAM} AND status ∈ {ACTIVE,TRIALING}`. | Four counts; step-to-step ratios computed app-side, `—` when previous step is 0. |
| Churn panel: cancellations | `count(Subscription where canceledAt >= startOfMonth)`. | Direct count. |
| Churn panel: downgrades | App-side: count distinct subscriptions where the catalog price tied to `stripePriceId` is strictly less than the previous-month catalog price for that `userId`. Approximated as "subscriptions with `updatedAt >= startOfMonth` and `plan != FREE` whose current `plan` is `PRO` while a previously linked `stripePriceId` mapped to `TEAM`" — see R-2 caveats in `research.md`. | App-side. |
| Churn panel: MRR lost | `sum(PLANS[sub.plan].priceMonthly for sub canceled this month) + (MRR difference for each downgraded sub)`. | App-side. |
| Churn panel: net MRR delta | `(MRR added this month: new paying subs) − (MRR lost: cancellations + downgrades)`. | App-side. |
| Signups daily (30d) | `groupBy by date(User.createdAt) where createdAt >= now()-30d`. | Raw SQL via Prisma `$queryRaw` (Prisma `groupBy` does not support date truncation). |
| Jobs daily (30d) | `groupBy by date(Job.startedAt), Job.status (COMPLETED vs FAILED only) where startedAt >= now()-30d`. | Raw SQL via Prisma `$queryRaw`. |
| MRR monthly (12 months) | For each of the trailing 12 calendar months, compute MRR-at-month-end by replaying acquisitions/cancellations. | App-side; see `lib/admin/home/trends.ts`. |
| New paying users (30d) | `Subscription where plan ∈ {PRO,TEAM} AND status ∈ {ACTIVE,TRIALING} AND createdAt >= now()-30d` ordered by `createdAt desc`, joined to `User.email`, capped at 50. | Direct Prisma query. |
| Cancellations (30d) | `Subscription where canceledAt >= now()-30d` ordered by `canceledAt desc`, joined to `User.email`, capped at 50. | Direct Prisma query. |
| Top users this month | Group `Job.startedAt >= startOfMonth` by `project.userId`, count desc, limit 5; join to User email + plan. | Raw SQL (groupBy across relations). |
| Top projects this month | Group `Job.startedAt >= startOfMonth` by `Job.projectId`, count desc, limit 5; join to project key + owner email. | `prisma.job.groupBy({ by: ['projectId'], where: ..., _count: true, orderBy: { _count: { projectId: 'desc' } }, take: 5 })` then enrich. |

## Alert detectors (canonical conditions)

| Alert | Condition | Data source |
|-------|-----------|-------------|
| Low success rate | `denominator >= 20 AND numerator/denominator < 0.9` where `denominator = count(Job where status ∈ {COMPLETED,FAILED} AND startedAt >= now()-7d)` and `numerator = count(Job where status = COMPLETED AND startedAt >= now()-7d)` | `Job` |
| Stripe webhook errors | `count(WebhookOutcome where status = FAILURE AND receivedAt >= now()-24h) >= 1` | `WebhookOutcome` |
| Stale critical cron | For each `CriticalCron` enum value: `lastSuccessAt < now()-36h` OR no `CronRun` row exists | `CronRun` |

Each detector returns a typed `Alert` object:
```ts
{ kind: 'LOW_SUCCESS_RATE' | 'STRIPE_WEBHOOK_ERRORS' | 'STALE_CRITICAL_CRON'; message: string; href: string }
```
Where `href` points to the relevant deeper view (e.g., `/admin/insights` or a future failed-jobs view; until those views exist the link target is `/admin` itself so the contract is honored without a 404).

## State transitions

Only `CronRun` and `WebhookOutcome` have life-cycle behavior worth describing.

- **`CronRun`**: created on first heartbeat (upsert); `lastSuccessAt` advanced monotonically by every subsequent heartbeat for the same `cron`. Never deleted. No deletion path is exposed via API.
- **`WebhookOutcome`**: write-once append. No update path. The status (`SUCCESS`/`FAILURE`) is decided at insert time and never changes.

No transitions on `Subscription`, `User`, `Job` are introduced by this feature — they are read as-is.
