# Research: Health Scan Metrics - Trend Lines, Sparklines and History Enrichment

**Date**: 2026-03-30
**Feature Branch**: `AIB-404-health-scan-metrics`

## Research Tasks

### R1: Trend Endpoint Query Strategy

**Question**: How to efficiently query last-N scores per module in a single endpoint?

**Decision**: Single Prisma query per active module type using `findMany` with `where: { status: 'COMPLETED', score: { not: null } }`, `orderBy: { completedAt: 'desc' }`, `take: 20`, selecting only `score` and `completedAt`. Four parallel queries wrapped in `Promise.all`.

**Rationale**: Four small indexed queries (on `projectId` + `scanType` + `status`) are faster and simpler than a single raw SQL query with window functions. Each returns at most 20 rows. `Promise.all` parallelizes them for sub-200ms response.

**Alternatives considered**:
- Single raw SQL with `ROW_NUMBER() OVER (PARTITION BY scanType)`: More complex, harder to maintain, marginal perf gain for small result sets. Rejected.
- Aggregate in the main health polling endpoint: Would add latency to the 2-second polling cycle. Rejected per spec requirement (fetch once, separate endpoint).

---

### R2: Sparkline Rendering Approach

**Question**: How to render mini sparklines (~40px height, no axes) on module cards?

**Decision**: Use Recharts `ResponsiveContainer` + `LineChart` with axes/grid/tooltip hidden. Pass trend data points as `[{ score }]` array. Stroke uses module-appropriate semantic color. No new dependencies.

**Rationale**: Recharts is already a project dependency (used in Quality Gate drawer). A `LineChart` with hidden axes produces a clean sparkline. `ResponsiveContainer` handles width adaptation.

**Alternatives considered**:
- SVG path rendered manually: Lighter but requires manual coordinate math, curve smoothing. Rejected for maintenance burden.
- `recharts` `AreaChart` with fill: Heavier visual weight for a 40px sparkline. Line is cleaner at small scale. Rejected.
- Third-party sparkline library (e.g., `react-sparklines`): Adds a dependency. Forbidden per project rules (no extra UI libs). Rejected.

---

### R3: Scan History Enrichment — Data Availability

**Question**: Are `tokensUsed` and `costUsd` already available in the scan history API response?

**Decision**: `tokensUsed` and `costUsd` exist on the `HealthScan` Prisma model but are NOT currently included in the scan history `select` clause. Need to add them to the `select` in the GET handler of `/api/projects/[projectId]/health/scans/route.ts`.

**Rationale**: The fields exist in the database schema. The scan history endpoint currently selects: `id, scanType, status, score, issuesFound, issuesFixed, baseCommit, headCommit, durationMs, errorMessage, startedAt, completedAt, createdAt`. Adding `tokensUsed: true` and `costUsd: true` to the select is a minimal change.

**Alternatives considered**:
- Separate endpoint for telemetry data: Unnecessary network request for data already in the same table. Rejected.
- Include in report JSON: Telemetry is operational metadata, not scan results. Keeping it as top-level fields is cleaner. Rejected.

---

### R4: Area Chart in Module Drawers — Pattern Reuse

**Question**: How to reuse the Quality Gate area chart pattern for active module drawers?

**Decision**: Extract a shared `ModuleAreaChart` component that accepts `data: { date: string; score: number }[]` and renders the same Recharts `AreaChart` pattern used in `quality-gate-drawer.tsx` (lines 132-166). Same styling: `CartesianGrid`, `XAxis` with date formatting, `YAxis` domain `[0, 100]`, `Area` with monotone interpolation, primary color stroke + 10% fill.

**Rationale**: Direct pattern copy from the working Quality Gate implementation ensures visual consistency. Extracting to a shared component avoids duplication and allows the Quality Gate drawer to use it as well in the future.

**Alternatives considered**:
- Inline chart in each drawer: Code duplication across 4 module drawers + Quality Gate. Rejected.
- Different chart type (bar, line-only): Spec explicitly requires area chart matching Quality Gate pattern. Rejected.

---

### R5: Metric Icon Formatting

**Question**: How to format and display the 4 metric values (issues, cost, tokens, duration)?

**Decision**: Use compact formatting functions:
- **Issues**: Integer display, e.g., "3" or "0"
- **Cost**: USD with 2 decimal places, e.g., "$1.23"; sub-cent shows "$0.00"
- **Tokens**: Compact with "k" suffix for thousands, e.g., "12.3k" or "450"
- **Duration**: Human-readable, e.g., "2m 15s", "45s", "< 1s"
- **Null values**: Display as "—" (em dash)

**Rationale**: Matches industry-standard dashboard conventions. Compact formatting keeps the history line readable at small sizes. Em dash for null is universally understood.

**Alternatives considered**:
- Raw numbers without formatting: Poor readability for large token counts and millisecond durations. Rejected.
- Hiding null metrics entirely: Would cause inconsistent row layouts per spec edge case analysis. Rejected.

---

### R6: Sparkline Minimum Data Threshold

**Question**: When should sparklines show vs hide?

**Decision**: Show sparkline when a module has >= 3 completed scans with non-null scores. Below 3, hide the sparkline entirely (no placeholder).

**Rationale**: 3 points is the minimum for a meaningful visual trend direction (up, down, flat). Matches spec acceptance criteria. No placeholder avoids visual noise on new projects.

**Alternatives considered**:
- 2-point minimum: A single line segment doesn't convey trend. Rejected.
- Show "Not enough data" text: Adds clutter to a compact card. Rejected per spec (just hide).

---

### R7: WCAG AA Compliance for Sparklines

**Question**: How to ensure sparkline visual elements meet WCAG AA contrast?

**Decision**: Use `hsl(var(--primary))` for sparkline stroke color — this is the same color used in the Quality Gate area chart and is already validated against both light and dark theme backgrounds. The sparkline has no text, so the 4.5:1 text ratio applies only to the surrounding card content (already compliant). The 3:1 ratio for non-text graphical elements applies to the line stroke.

**Rationale**: Primary color is designed to meet contrast requirements in the existing theme system. No custom colors needed.

**Alternatives considered**:
- Per-module colored sparklines (green for improving, red for declining): Adds complexity and may fail contrast on certain backgrounds. The trend direction is already shown by the line shape. Rejected.
