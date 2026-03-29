# Research: Health Dashboard — Passive Modules (Quality Gate & Last Clean)

## Research Summary

All NEEDS CLARIFICATION items resolved via codebase investigation.

---

## R1 — Quality Gate Data Source & Aggregation Window

**Question**: How is the Quality Gate score currently derived, and what changes are needed for the 30-day aggregation window?

**Finding**: The current health API (`app/api/projects/[projectId]/health/route.ts:101-115`) derives Quality Gate from the **single latest** completed verify job with a non-null `qualityScore`. The spec requires aggregating **all** COMPLETED verify jobs from FULL-workflow tickets at SHIP stage within the last 30 days.

**Decision**: Extend the health API to query jobs within a 30-day window, filtering by `ticket.workflowType = 'FULL'`, `ticket.stage = 'SHIP'`, `job.command = 'verify'`, `job.status = 'COMPLETED'`, and `job.qualityScore IS NOT NULL`. Compute average, count, trend (vs previous 30 days), and threshold distribution server-side.

**Rationale**: Server-side aggregation avoids sending all job records to the client. The Prisma query can efficiently filter and aggregate using `where` + `orderBy`.

**Alternatives considered**: Client-side aggregation (rejected — would require fetching all jobs), dedicated cron-based materialized view (over-engineering for this use case).

---

## R2 — Quality Score Dimensions Storage

**Question**: Where are per-dimension scores stored for shipped tickets?

**Finding**: `Job.qualityScoreDetails` (`prisma/schema.prisma`) stores a JSON string with dimension sub-scores. Parsed via `parseQualityScoreDetails()` in `lib/quality-score.ts`. The JSON structure contains per-dimension scores keyed by `agentId` with `score` and `weight` fields.

**Decision**: Parse `qualityScoreDetails` JSON for each qualifying job to compute per-dimension averages for the drawer view. Use `DIMENSION_CONFIG` from `lib/quality-score.ts` as the canonical dimension list.

**Rationale**: Data already exists — no schema changes needed.

---

## R3 — Last Clean Staleness Thresholds Implementation

**Question**: How should staleness thresholds be computed and communicated to the client?

**Finding**: The current API returns `lastClean.summary = "X days ago"` but no structured staleness state. The card currently shows "OK" label when a cleanup exists, with no visual differentiation for aging cleanups.

**Decision**: Add a `stalenessStatus` field to the lastClean module response: `'ok' | 'warning' | 'alert' | null`. Compute server-side based on elapsed days since `lastCleanDate`: <30 days = `'ok'`, 30-60 days = `'warning'`, >60 days = `'alert'`, no cleanup = `null`.

**Rationale**: Server-side computation keeps the client thin and ensures consistent threshold application.

---

## R4 — Last Clean Job Data Availability

**Question**: What structured data do cleanup jobs contain?

**Finding**: Cleanup jobs (`command: 'clean'`) have standard Job fields (`status`, `completedAt`, `output`). The `output` field may contain structured cleanup results. There is a `LastCleanReport` type in `lib/health/types.ts` with `filesCleaned`, `remainingIssues`, and `summary` fields — but this is for HealthScan reports, not Job records.

**Decision**: Query the cleanup job's `output` field and attempt to parse structured data (files cleaned, remaining issues). If the output doesn't contain structured data, degrade gracefully per spec Decision 2. For the drawer, fetch recent cleanup jobs with their `output` field.

**Rationale**: Graceful degradation is already specified; no schema changes needed.

---

## R5 — Passive Module Drawer Click Handling

**Question**: How do passive modules currently handle clicks, and what's needed?

**Finding**: In `health-dashboard.tsx:78-79`, the `onClick` prop for module cards is `undefined` for non-active modules (`ACTIVE_SCAN_SET.has(type)` check). The `ScanDetailDrawer` uses `useScanReport` which is disabled for non-active types. Passive modules are currently non-interactive.

**Decision**: Make passive module cards clickable by removing the `ACTIVE_SCAN_SET` gate on `onClick`. Create new drawer content components for Quality Gate and Last Clean that don't use `useScanReport` (which queries HealthScan records) but instead fetch data from new dedicated API endpoints.

**Rationale**: Passive modules need their own data-fetching pattern since they don't have HealthScan records.

---

## R6 — Trend Chart Technology

**Question**: What charting library should be used for the Quality Gate trend chart?

**Finding**: The project uses **Recharts 2.x** (per CLAUDE.md) for analytics dashboard charts.

**Decision**: Use Recharts `LineChart` or `AreaChart` for the Quality Gate trend chart in the drawer. Data points will be per-ticket (ticket key + score + date) plotted chronologically.

**Rationale**: Consistent with existing analytics dashboard patterns. No new dependency needed.

---

## R7 — Global Health Score Integration

**Question**: How does the Quality Gate 30-day average integrate with the global score?

**Finding**: `lib/health/score-calculator.ts` uses `calculateGlobalScore()` which averages all non-null module scores equally. The `qualityGate` field is already one of the 5 inputs.

**Decision**: Update the `qualityGate` value passed to `calculateGlobalScore()` to use the 30-day average instead of the latest single job score. The HealthScore record's `qualityGate` field should also be updated with this average.

**Rationale**: The weight redistribution algorithm already handles null modules — using the 30-day average just changes the input value, not the algorithm.
