# Research: Health Scan Metrics - Trend Lines, Sparklines and History Enrichment

**Feature Branch**: `AIB-412-copy-of-copy`
**Created**: 2026-03-31

## Research Task 1: Scan History API — Missing Telemetry Fields

**Question**: The scan history GET endpoint does not return `tokensUsed` or `costUsd`. How should these be added?

**Decision**: Add `tokensUsed` and `costUsd` to the Prisma `select` clause in the GET handler at `app/api/projects/[projectId]/health/scans/route.ts`.

**Rationale**: Both fields already exist in the `HealthScan` Prisma model (`tokensUsed Int?`, `costUsd Float?`). They are already accepted and stored by the PATCH status endpoint. The GET handler simply omits them from its `select` — a one-line fix per field.

**Alternatives considered**:
- Creating a separate "telemetry" endpoint — rejected, unnecessary complexity for two fields already on the model
- Adding them only when `includeReport=true` — rejected, these are lightweight scalar fields that should always be included

## Research Task 2: Trend Data Endpoint Design

**Question**: What endpoint shape should deliver trend data for sparklines and area charts?

**Decision**: New endpoint `GET /api/projects/{projectId}/health/trends` returning `{ trends: Record<ScanType, { date: string; score: number }[]> }`. Queries the last 20 COMPLETED scans per active module type with non-null scores, returning only `completedAt` (as `date`) and `score`.

**Rationale**: A single request fetches all module trends, avoiding N+1 requests from the dashboard. The response is lightweight (date + score per point). The 20-scan default provides enough data for meaningful sparklines (~40px height) without excessive payload. An optional `limit` query parameter allows future flexibility.

**Alternatives considered**:
- Embedding trend data in the main health polling response — rejected per FR-009 (trend data must NOT be in polling cycle)
- One request per module type — rejected, would cause 4 parallel requests on dashboard mount
- Using the existing scan history endpoint — rejected, returns too much data (full scan records) and requires separate calls per type

## Research Task 3: Sparkline Rendering Approach

**Question**: How to render minimal sparklines (~40px, no axes) on module cards using Recharts?

**Decision**: Use Recharts `LineChart` with `ResponsiveContainer` (height 40px). Disable all axes, grid, tooltips, and legends. Use a single `Line` with `dot={false}` and `strokeWidth={1.5}`. Color the line using `getScoreColor()` based on the most recent score.

**Rationale**: Recharts is already a project dependency (v3.8.1). A minimal `LineChart` (not `AreaChart`) is more appropriate for sparklines since area fill at 40px height would be visually noisy. The `ResponsiveContainer` handles width responsiveness automatically.

**Alternatives considered**:
- SVG path rendered manually — rejected, Recharts is already available and handles edge cases (data scaling, responsive sizing)
- `AreaChart` with fill — rejected, at 40px height the filled area dominates and reduces trend line clarity
- Canvas-based chart — rejected, React reconciliation works better with SVG

## Research Task 4: Area Chart Pattern Reuse

**Question**: How to reuse the Quality Gate drawer's area chart pattern for module drawers?

**Decision**: Extract the area chart JSX from `quality-gate-drawer.tsx` into a shared `ScoreTrendChart` component in `components/health/drawer/score-trend-chart.tsx`. The component accepts `data: { date: string; score: number }[]` and renders the same Recharts `AreaChart` with identical styling (CartesianGrid, XAxis date formatting, YAxis [0,100], themed tooltip, monotone Area with primary color).

**Rationale**: The Quality Gate drawer already has a production-tested area chart pattern. Extracting it avoids code duplication and ensures visual consistency across module drawers and the Quality Gate drawer.

**Alternatives considered**:
- Copy-paste the chart into each drawer — rejected, violates DRY and creates maintenance burden
- Using a different chart library — rejected, Recharts is already in use

## Research Task 5: TanStack Query Integration for Trends

**Question**: How should trend data be fetched and cached?

**Decision**: Create a `useHealthTrends(projectId)` hook using `useQuery` with query key `['health', projectId, 'trends']`. Fetch once on mount with `staleTime: 60_000` (1 minute) and `gcTime: 5 * 60_000`. No polling — trends are static relative to the 2s health polling. The dashboard passes trend data down to module cards (sparklines) and drawers (area charts).

**Rationale**: Trend data changes only when new scans complete, which happens on the order of minutes, not seconds. A long staleTime prevents refetching on every drawer open. The data is fetched once and shared between sparklines and area charts per FR-009.

**Alternatives considered**:
- Polling at 15s intervals — rejected, trend data rarely changes; wastes bandwidth
- Fetching per-module on drawer open — rejected, contradicts FR-009 (single request on mount)
- Embedding in health polling response — rejected, contradicts FR-009

## Research Task 6: Metric Icon Display & Formatting

**Question**: How to format and display the four metric icons (issues, cost, tokens, duration) in scan history?

**Decision**: Use lucide-react icons: `AlertTriangle` (issues), `Coins` (cost), `Zap` (tokens), `Clock` (duration). Each renders as a 12px icon + formatted value. Formatting: issues as plain number, cost as `$X.XX`, tokens as abbreviated (`12.5k`), duration as human-readable (`2.3s`, `1m 15s`). Wrap each in a `Tooltip` (from shadcn/ui) explaining the metric. Icons only render when the value is non-null.

**Rationale**: The icons are already available in lucide-react (project dependency). The shadcn/ui Tooltip component provides accessible hover tooltips that match the project's design system. Conditional rendering (hide when null) keeps the UI clean per Decision 3 in the spec.

**Alternatives considered**:
- Text labels instead of icons — rejected, too wide for the compact history entry layout
- Always showing all 4 icons with "N/A" for nulls — rejected per spec Decision 3
