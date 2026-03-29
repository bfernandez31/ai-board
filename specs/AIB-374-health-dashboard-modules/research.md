# Research: Health Dashboard - Passive Modules (Quality Gate & Last Clean)

**Date**: 2026-03-29

## Research Topic 1: Quality Gate 30-Day Aggregation Query

**Decision**: Query `Job` model joined with `Ticket` for SHIP-stage tickets with COMPLETED verify jobs having non-null `qualityScore`, filtered to last 30 days by `Job.completedAt`.

**Rationale**: The `Job` model already stores `qualityScore` (Int?) and `qualityScoreDetails` (String? JSON) on completed verify jobs. The `Ticket` model has a `stage` enum field with `SHIP` value. Joining via `Job.ticketId → Ticket.id` with `Ticket.projectId` filter gives us exactly the qualifying data. No new indexes needed — existing `Job(ticketId)` and `Ticket(projectId, stage)` indexes cover the query.

**Alternatives considered**:
- Caching aggregation in `HealthScore` table: Rejected because spec FR-009 requires recalculation on every page load. The query is lightweight (<100 rows per 30-day window per project).
- Pre-computing in a cron job: Rejected — unnecessary complexity for a derived read.

## Research Topic 2: Quality Score Details Dimension Structure

**Decision**: Parse `qualityScoreDetails` JSON using existing `parseQualityScoreDetails()` from `lib/quality-score.ts`. Dimension names are: Compliance (40%), Bug Detection (30%), Code Comments (20%), Historical Context (10%), Spec Sync (0%).

**Rationale**: The `DimensionScore` interface provides `name`, `score`, `weight`, `weightedScore`. Averaging each dimension's `score` across qualifying tickets gives per-dimension averages for the drawer. Dimensions with missing data in malformed JSON show "---" per edge case spec.

**Alternatives considered**:
- Custom dimension parsing: Rejected — existing `parseQualityScoreDetails` handles validation and null safety.

## Research Topic 3: Trend Calculation (Current vs Previous 30-Day Period)

**Decision**: Calculate two separate averages — current period (last 30 days) and previous period (31-60 days ago) — and compute the difference. When previous period has zero qualifying tickets, show "N/A".

**Rationale**: Simple arithmetic comparison aligns with spec FR-003 and auto-resolved decision on trend display. No percentage change — just the raw score delta (e.g., "+15" or "-5") to avoid division-by-zero complexity.

**Alternatives considered**:
- Percentage change: Rejected — creates confusing UX when previous period score is low (e.g., 10→20 = +100% seems dramatic but is only +10 points).
- Rolling average: Rejected — spec explicitly defines 30-day fixed windows.

## Research Topic 4: Last Clean Data Derivation

**Decision**: Query `Job` model for `command='clean'` and `status='COMPLETED'`, ordered by `completedAt` DESC. The most recent job provides the card data. History drawer shows up to 10 most recent jobs.

**Rationale**: The existing route already queries this pattern (lines 121-133 of `app/api/projects/[projectId]/health/route.ts`). Extending it to include `filesCleaned` and `remainingIssues` requires checking `qualityScoreDetails` or the job's output fields. The `HealthScore` model already stores `lastCleanDate` and `lastCleanJobId`.

**Alternatives considered**:
- Using `lib/db/cleanup-analysis.ts` functions: Partially applicable — `getLastCleanupInfo` looks at CLEAN workflow tickets at SHIP stage, not Job model directly. We need the Job model for files/issues counts. Will use a direct Prisma query for consistency with the existing health route pattern.

## Research Topic 5: Passive Module Drawer Data Fetching

**Decision**: Extend the GET `/api/projects/{projectId}/health` endpoint to include `qualityGateDetail` and `lastCleanDetail` nested objects in the response. The drawer reads from `useHealthPolling` data (already cached) rather than creating a separate fetch hook.

**Rationale**: The `useScanReport` hook is explicitly disabled for passive modules (`ACTIVE_SET` check). Rather than creating a parallel hook, we enrich the existing health response with detail data. This avoids an extra API call and leverages the existing 2s polling cache. The drawer for passive modules reads from `modules.qualityGate` and `modules.lastClean` in the health response.

**Alternatives considered**:
- Separate `/api/projects/{projectId}/health/quality-gate` endpoint: Rejected — adds API surface area when data is small enough to inline.
- New `usePassiveModuleData` hook: Rejected — duplicates polling logic already in `useHealthPolling`.

## Research Topic 6: Recharts Trend Graph Pattern

**Decision**: Use `LineChart` from Recharts for Quality Gate trend, following the existing `quality-score-trend-chart.tsx` pattern in `/components/analytics/`. Data points grouped by week (ISO week number) with `ResponsiveContainer` wrapper.

**Rationale**: The analytics module already uses `LineChart` for quality score trends. Reusing the same pattern (Card wrapper, aurora-bg-subtle, theme-aware colors, custom tooltip) ensures visual consistency. Weekly grouping balances granularity with readability for 30-60 day windows.

**Alternatives considered**:
- AreaChart: Rejected — LineChart is the established pattern for score trends in this codebase.
- Daily grouping: Rejected — too granular for projects with few SHIP tickets per week.

## Research Topic 7: Threshold Distribution Calculation

**Decision**: Reuse existing threshold labels from `lib/quality-score.ts`: Excellent (90-100), Good (70-89), Fair (50-69), Poor (0-49). Count qualifying tickets in each bucket.

**Rationale**: Spec auto-resolved decision confirms reuse of existing threshold system. The `getScoreThreshold()` function already maps scores to labels.

**Alternatives considered**: None — straightforward reuse.
