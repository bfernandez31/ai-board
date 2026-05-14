# Data Model: Admin Insights cosmetic refresh + FAILED diagnostics

**Feature**: AIB-798
**Branch**: `AIB-798-admin-insights-page`
**Date**: 2026-05-14

This feature adds **no persisted entities** and **no schema migrations**. All
display projections are computed from existing rows. The only data-shape
change is an additive field on the API response (and the upstream repository
return shape) — see §"Extended Display Projection" below.

---

## Persisted Entities (read-only references)

The feature reads from the following existing tables. No writes, no migrations.

### `InsightsReport`

Source of truth: `prisma/schema.prisma:896-916`.

| Field | Type | Used by |
|-------|------|---------|
| `id` | `Int` (PK) | Row key, selection state, panel API calls |
| `status` | `InsightsRunStatus` (`RUNNING`/`COMPLETED`/`FAILED`) | Status badge, body switching, duration eligibility |
| `generatedAt` | `DateTime` | Table column 1 (full year) |
| `periodStart` | `DateTime` | Table column 2 (compact period start) |
| `periodEnd` | `DateTime` | Table column 2 (compact period end), preflight semantics |
| `createdAt` | `DateTime` | Duration numerator (start time) |
| `completedAt` | `DateTime?` | Duration denominator (end time) for COMPLETED rows |
| `errorReason` | `String?` (≤500 chars) | FAILED panel inline body |
| `jobId` | `Int?` (FK → `Job.id`, unique) | Bridge to `workflowRunId` for the GH link |
| `sessionsCount` | `Int?` | Metadata header (right panel) |
| `ticketsCount` | `Int?` | Metadata header (right panel) |
| `artifactSize` | `Int?` | (Not displayed — kept in `ReportListEntry` shape) |

### `Job` (via `InsightsReport.jobId`)

Source of truth: `prisma/schema.prisma:35-83`.

| Field | Type | Used by |
|-------|------|---------|
| `workflowRunId` | `BigInt?` | Composes the GH Actions URL in the FAILED panel (FR-012). Null → fallback text + no link (FR-013). |

**Join contract**:
- `InsightsReport.job` (defined at `prisma/schema.prisma:908`) is a nullable
  one-to-one relation. We read it in `listReports` via
  `include: { job: { select: { workflowRunId: true } } }`.
- The selection projection — `{ workflowRunId: true }` — limits the join to a
  single column to avoid pulling the entire `Job` row (logs, ticket linkage,
  etc.) for every report on every poll.

**Serialization note**: `BigInt` is not JSON-safe in standard Node responses.
`toListEntry` MUST convert via `.toString()` before emitting; the client treats
it as a string thereafter (URL composition needs no arithmetic).

---

## Display Projections (not persisted)

### `ReportListEntry` (extended)

Source: `app/lib/insights/repository.ts:141-153`.

```ts
export interface ReportListEntry {
  id: number;
  status: InsightsRunStatus;
  generatedAt: string;        // ISO 8601
  periodStart: string;        // ISO 8601
  periodEnd: string;          // ISO 8601
  sessionsCount: number | null;
  ticketsCount: number | null;
  artifactSize: number | null;
  errorReason: string | null;
  completedAt: string | null; // ISO 8601 (null while RUNNING)
  createdAt: string;          // ISO 8601
  // --- NEW (AIB-798) ---
  workflowRunId: string | null; // BigInt serialized as string; null if no job or no run dispatched
}
```

**Validation rules**:
- `workflowRunId`, when non-null, MUST match `/^[0-9]+$/`. The DB column is
  `BigInt` so no further validation is required at the transport boundary,
  but the GH URL builder MUST guard against an empty string to keep the URL
  from ending in `/runs/`.
- All other fields retain their existing validation (no changes).

**Backwards compatibility**:
- The field is additive. Existing consumers (`useInsightsReports`,
  `RunAnalysisButton` optimistic entry builder) ignore unknown fields.
- The optimistic entry in `RunAnalysisButton` (`buildOptimisticEntry`, lines
  39-54) MUST set `workflowRunId: null` to satisfy the new field's typing.

### `PastReportRow` (UI-only projection — no separate type)

The dense table renders a logical row composed of the following derived fields
from `ReportListEntry`. No new TypeScript type — the table accepts
`ReportListEntry[]` directly and computes derivations inline via the helpers
below.

| Display field | Computation | Helper |
|---------------|-------------|--------|
| Generation date | `new Date(row.generatedAt)` → `M/D/YYYY` (locale-stable formatter or `toISOString().slice(0,10)`) | inline / `formatDateFull` |
| Compact period | `start = new Date(row.periodStart)`, `end = new Date(row.periodEnd)`; output per D-7 | `formatCompactPeriod` |
| Status badge | `row.status` | existing `statusBadgeVariant` |
| Duration | `formatCompactDuration(row.createdAt, row.completedAt, row.status)` per D-8 | `formatCompactDuration` |
| Selected? | `row.id === selectedId` (or fallback to default-display id) | client state |

### `FailureDiagnosticsView` (UI-only projection — no separate type)

The right-panel FAILED composition uses the selected `ReportListEntry`
directly. No new TypeScript type; the panel's props are:

```ts
interface FailureDiagnosticsPanelProps {
  report: ReportListEntry;          // status === 'FAILED' invariant — asserted by caller
  preflight: { canTrigger: boolean; refusal: { refusalCode: string; message: string } | null };
  latestIsRunning: boolean;
}
```

The panel computes `githubRunUrl = buildInsightsRunUrl(report.workflowRunId)`
internally; when `null`, it renders the fallback message (FR-013).

---

## State Transitions

**No state transitions are added by this feature.** The display surfaces are
read-only (with the exception of the "Reessayer" button, which dispatches via
the existing `POST /api/admin/insights/trigger` endpoint — that endpoint owns
its own atomic state machine; see `app/lib/insights/repository.ts:69-114,
120-134`). The plan does not introduce or modify any status flip.

---

## Migrations

**None.** No schema changes, no Prisma migration, no `prisma generate` step
required by this feature alone (the `Job.workflowRunId` column already exists
and is already indexed at `prisma/schema.prisma:82`).
