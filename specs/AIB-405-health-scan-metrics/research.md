# Research: Health Scan Metrics — Trend Lines, Sparklines & History Enrichment

**Branch**: `AIB-405-health-scan-metrics`
**Date**: 2026-03-30

---

## R1: Scan History API — Missing Fields

**Question**: The scan history API currently returns `durationMs` but omits `tokensUsed` and `costUsd`. How should these be added?

**Decision**: Add `tokensUsed` and `costUsd` to the Prisma `select` clause in the GET `/api/projects/[projectId]/health/scans` route and extend the `ScanHistoryItem` TypeScript interface.

**Rationale**: These fields already exist in the `HealthScan` Prisma model (both nullable). The API simply doesn't select them. Adding them to the select clause is a one-line change per field with zero schema migration needed.

**Alternatives Considered**:
- Separate telemetry endpoint — rejected as over-engineered for 2 additional fields
- Include in main health polling response — rejected to avoid bloating the 2s polling payload

---

## R2: Trend Data Endpoint Design

**Question**: Should trend data be served by a new endpoint, or added to an existing one?

**Decision**: New endpoint `GET /api/projects/[projectId]/health/trends` returning last 20 completed scan scores per active module type.

**Rationale**:
- Must NOT be part of the 2s polling cycle (FR-008)
- Different caching characteristics (fetched once on mount, stale for minutes)
- The main health endpoint already has a well-defined shape; adding trend arrays would change its contract
- Quality Gate already has its own trend endpoint as precedent

**Alternatives Considered**:
- Query param on existing `/health` endpoint — rejected because it would complicate the polling logic
- Separate endpoint per module — rejected; single call with all 4 modules is more efficient

---

## R3: Sparkline Rendering Approach

**Question**: Use Recharts `LineChart` or a simpler SVG for sparklines?

**Decision**: Use Recharts `LineChart` with minimal configuration (no axes, no grid, no tooltip, ~40px height) wrapped in `ResponsiveContainer`.

**Rationale**:
- Recharts is already a dependency (v3.8.1) used extensively in analytics and Quality Gate
- A bare `LineChart` with a single `Line` element is lightweight enough for card-level rendering
- Consistent rendering engine across all charts in the app
- Recharts `LineChart` supports `isAnimationActive={false}` for instant render in cards

**Alternatives Considered**:
- Raw SVG `<polyline>` — simpler but diverges from established patterns and loses Recharts' responsive container
- `@nivo/sparkline` — adds a new dependency (forbidden by constitution)

---

## R4: Number Formatting for Telemetry Display

**Question**: How to format token counts and costs in compact icon layout?

**Decision**: Reuse existing `formatAbbreviatedNumber` and `formatCost` from `lib/analytics/aggregations.ts`. For duration, reuse `formatDuration` from the same file.

**Rationale**: These utilities already handle the exact formatting patterns specified (e.g., "12.3K" for tokens, "$X.XX" for cost, "1.2s" for duration). No new code needed.

**Alternatives Considered**:
- `Intl.NumberFormat` with `notation: 'compact'` — less control over decimal places, inconsistent with existing patterns

---

## R5: Tooltip Component Pattern

**Question**: Which tooltip pattern to use for metric icons in scan history?

**Decision**: Use the existing shadcn/ui `Tooltip` / `TooltipTrigger` / `TooltipContent` components from `components/ui/tooltip.tsx`, consistent with `JobStatusIndicator` usage.

**Rationale**: Already used throughout the app. Provides accessible hover behavior via Radix primitives. The scan history drawer already renders inside a `TooltipProvider` context.

**Alternatives Considered**:
- Recharts `Tooltip` — only works inside Recharts containers, not applicable here
- HTML `title` attribute — not accessible, no styling control

---

## R6: Area Chart in Module Drawers

**Question**: How to implement the score-over-time area chart in module drawers?

**Decision**: Clone the Quality Gate drawer's `AreaChart` pattern exactly — same imports, same `ResponsiveContainer` wrapper, same styling (192px height, monotone interpolation, `hsl(var(--primary))` stroke/fill, CartesianGrid with `stroke-muted`). Data source is the trend endpoint.

**Rationale**: FR-006 explicitly requires "following the established visual pattern used in the Quality Gate drawer." Visual consistency is a constitution principle (§II).

**Alternatives Considered**:
- New chart design — rejected per spec requirement for consistency
- LineChart instead of AreaChart — rejected for visual consistency with Quality Gate

---

## R7: Trend Data Fetching Strategy

**Question**: How should trend data be fetched and cached?

**Decision**: New `useHealthTrends` hook using TanStack Query's `useQuery` with:
- `staleTime: 5 * 60 * 1000` (5 minutes)
- `refetchOnWindowFocus: false`
- No `refetchInterval` (fetched once on mount, not polled)
- Query key: `['health', projectId, 'trends']`

**Rationale**: FR-008 requires trend data to be fetched once on mount and excluded from the 2s polling cycle. A 5-minute stale time means the data refreshes if the user navigates away and back, but not during active dashboard use.

**Alternatives Considered**:
- Include in `useHealthPolling` with conditional fetch — would complicate the polling hook and risk accidental re-fetching
- `staleTime: Infinity` — too aggressive; trends should refresh on re-mount

---

## R8: Handling Null Telemetry in History

**Question**: How to handle scans where `tokensUsed`, `costUsd`, or `durationMs` is null?

**Decision**: Show the metric icon with a dash ("—") as the value. Never hide icons conditionally to maintain consistent layout across all scan rows.

**Rationale**: FR-011 says "showing a dash or hiding the icon." Consistent icon positions are better for scannability. The spec's edge case section confirms dashes are acceptable. The existing `HistoryEntry` already uses "—" for null scores.

**Alternatives Considered**:
- Hide icon entirely — creates ragged layouts, harder to scan visually
- Show "0" — explicitly forbidden by FR-011 as misleading
