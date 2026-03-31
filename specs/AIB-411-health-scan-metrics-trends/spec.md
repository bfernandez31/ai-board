# Feature Specification: Health Scan Metrics - Trend Lines, Sparklines and History Enrichment

**Ticket**: AIB-411
**Feature Branch**: `AIB-411-health-scan-metrics-trends`
**Created**: 2026-03-31
**Status**: Draft
**Input**: Enrich health scan history with telemetry metrics (cost, tokens, duration), add sparklines to module cards, add area charts to module drawers, and create a dedicated trend endpoint

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Where to place sparklines on module cards
- **Policy Applied**: AUTO (resolved to PRAGMATIC based on existing card layout)
- **Confidence**: High (score: 0.9) - The module card has clear visual hierarchy: header, summary, trend, distribution, button, footer. Sparkline fits naturally between the trend indicator and distribution bar.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Placing sparkline after the trend indicator keeps visual flow logical (trend text → trend visual)
  2. 40px height keeps cards compact while still providing readable at-a-glance trends
- **Reviewer Notes**: Sparkline renders only for active scan modules (not Quality Gate, which has its own trend chart in the drawer)

---

- **Decision**: How many data points (N) for the trend endpoint
- **Policy Applied**: AUTO (resolved to PRAGMATIC based on sparkline readability and data availability)
- **Confidence**: High (score: 0.85) - 20 data points provides enough resolution for sparklines while being a reasonable default
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Too few points (5) makes sparklines sparse; too many (50+) wastes bandwidth for a mini visualization
  2. A `limit` query parameter allows flexibility without over-engineering
- **Reviewer Notes**: Default of 20 recent COMPLETED scans per module; configurable via `limit` query param (max 100)

---

- **Decision**: Whether sparklines should use Recharts or a lightweight SVG
- **Policy Applied**: AUTO (resolved to PRAGMATIC based on existing dependencies)
- **Confidence**: High (score: 0.9) - Recharts 3.x is already in the project and used by the Quality Gate drawer. Using its `LineChart` with `ResponsiveContainer` is the simplest approach.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Recharts adds no new dependency; a custom SVG would be lighter but adds maintenance burden
  2. Recharts `LineChart` can be configured with no axes/grid/labels for a minimal sparkline look
- **Reviewer Notes**: Use `LineChart` (not `AreaChart`) for sparklines — the filled area at 40px height would obscure the trend line

---

- **Decision**: How to handle the area chart in active module drawers vs the existing Quality Gate drawer pattern
- **Policy Applied**: AUTO (resolved to CONSERVATIVE for consistency)
- **Confidence**: High (score: 0.9) - Following the exact same Recharts `AreaChart` pattern ensures visual consistency across all drawers
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Reusing the same chart config (CartesianGrid, XAxis date formatting, YAxis 0-100 domain, themed Tooltip) provides consistency
  2. Each module drawer gets its own score history vs Quality Gate which plots per-ticket scores
- **Reviewer Notes**: Chart data comes from the trend endpoint, not the scan history endpoint (avoids N+1 fetches per module)

---

- **Decision**: Whether `tokensUsed` and `costUsd` need special formatting
- **Policy Applied**: AUTO (resolved to PRAGMATIC)
- **Confidence**: High (score: 0.9) - Simple compact formatting is sufficient for inline display
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Cost: `$0.12` format (2 decimal places); sub-cent: `<$0.01`
  2. Tokens: compact notation (`1.2k`, `45.3k`) for readability in tight space
- **Reviewer Notes**: Tooltips show full values; inline display uses compact format

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enriched Scan History with Metric Icons (Priority: P1)

As a project owner reviewing scan history, I want to see cost, token usage, duration, and issue count as compact icons alongside the score badge so I can quickly assess scan operational metrics without opening individual scan details.

**Why this priority**: Core feature — transforms opaque history lines into informative metric displays.

**Independent Test**: Open the scan detail drawer for any active module; verify history entries show 4 metric icons with tooltips.

**Acceptance Scenarios**:

1. **Given** a completed scan with `issuesFound: 5`, `costUsd: 0.15`, `tokensUsed: 12500`, `durationMs: 45000`, **When** I view the scan history drawer, **Then** the history entry shows: AlertTriangle icon with "5", Coins icon with "$0.15", Zap icon with "12.5k", Clock icon with "45s" alongside the score badge
2. **Given** a completed scan where `costUsd` and `tokensUsed` are null (pre-existing scans without telemetry), **When** I view the scan history, **Then** those metric icons are hidden (only non-null metrics display)
3. **Given** any metric icon in the scan history, **When** I hover over it, **Then** a tooltip appears explaining the metric (e.g., "Cost in USD", "Tokens consumed", "Execution time", "Issues found")
4. **Given** the old "X issues" text format, **When** the feature is deployed, **Then** the text format is replaced by the AlertTriangle icon + number format

---

### User Story 2 - Scan History API Returns Telemetry Fields (Priority: P1)

As a frontend consumer, I want the scan history GET endpoint to include `tokensUsed` and `costUsd` fields so the UI can display operational metrics.

**Why this priority**: Backend prerequisite for history enrichment — without these fields, the UI cannot display cost/token data.

**Independent Test**: Call `GET /api/projects/:projectId/health/scans` and verify `tokensUsed` and `costUsd` are present in the response items.

**Acceptance Scenarios**:

1. **Given** the scan history API, **When** I fetch scans, **Then** each scan item includes `tokensUsed: number | null` and `costUsd: number | null` fields
2. **Given** a completed scan with `tokensUsed: 15000` and `costUsd: 0.23`, **When** I fetch it via the API, **Then** the values are returned as-is (no rounding/formatting server-side)
3. **Given** a scan without telemetry data, **When** I fetch it, **Then** `tokensUsed` and `costUsd` are `null`

---

### User Story 3 - Sparklines on Active Module Cards (Priority: P1)

As a project owner viewing the health dashboard, I want each active module card to show a mini trend line so I can see score trends at a glance without opening drawers.

**Why this priority**: Primary visual enhancement — provides instant trend visibility on the main dashboard.

**Independent Test**: View the health dashboard for a project with 3+ completed scans; verify sparklines appear on active module cards.

**Acceptance Scenarios**:

1. **Given** a module with 5 completed scans (scores: 60, 70, 75, 80, 85), **When** I view the module card, **Then** a ~40px height sparkline shows an upward trend line (no axes, no grid, no labels)
2. **Given** a module with 2 completed scans, **When** I view the module card, **Then** no sparkline is displayed
3. **Given** a module with exactly 3 completed scans, **When** I view the module card, **Then** the sparkline is displayed (3 is the minimum threshold)
4. **Given** the Quality Gate module card, **When** I view the dashboard, **Then** no sparkline is shown (Quality Gate has its own chart in the drawer)
5. **Given** modules with varying score ranges, **When** sparklines render, **Then** each sparkline uses a Y-axis domain of [0, 100] for consistent visual comparison across modules

---

### User Story 4 - Area Charts in Active Module Drawers (Priority: P2)

As a project owner drilling into a specific module, I want to see a full area chart of score evolution in the drawer so I can analyze historical trends with dates and hover details.

**Why this priority**: Detailed view complements the sparkline overview — lower priority because users must actively open the drawer.

**Independent Test**: Open the drawer for an active module with 3+ completed scans; verify the area chart renders with axes, dates, and tooltip.

**Acceptance Scenarios**:

1. **Given** a module with 5 completed scans, **When** I open its drawer, **Then** an area chart appears with: X-axis (dates formatted "Mon DD"), Y-axis (0-100), grid lines, hoverable tooltip showing date and score
2. **Given** a module with fewer than 2 data points, **When** I open its drawer, **Then** no area chart is displayed (need 2+ points for a meaningful line)
3. **Given** the area chart tooltip, **When** I hover over a data point, **Then** I see the formatted date and score value, styled consistently with the Quality Gate drawer chart

---

### User Story 5 - Trend Endpoint Fetched Once on Mount (Priority: P1)

As a performance-conscious developer, I want trend data fetched in a single call on mount and not included in the 2s polling cycle so the dashboard remains fast during active scans.

**Why this priority**: Architecture requirement — prevents trend data from bloating the high-frequency polling response.

**Independent Test**: Monitor network requests on dashboard mount; verify one `/health/trends` call and no trend data in polling responses.

**Acceptance Scenarios**:

1. **Given** dashboard mount, **When** the page loads, **Then** a single `GET /api/projects/:projectId/health/trends` request is made
2. **Given** an active scan polling at 2s intervals, **When** polling occurs, **Then** no trend data is included in the `/health` response
3. **Given** the trend response, **When** I inspect the payload, **Then** it contains an object keyed by module type (`SECURITY`, `COMPLIANCE`, `TESTS`, `SPEC_SYNC`), each with an array of `{ score, date }` points sorted chronologically
4. **Given** a module with no completed scans, **When** the trend endpoint responds, **Then** that module key has an empty array

---

### Edge Cases

- **What if a scan has `durationMs` but no `costUsd`/`tokensUsed`?** Each metric icon renders independently — only non-null values display. A scan may have duration (always set on completion) but no cost/token data (set by the workflow callback).
- **What if all 4 active modules have 3+ scans but one has 50+ scans?** The trend endpoint respects the `limit` parameter (default 20) — all modules get the same N most recent data points regardless of total scan count.
- **What if a scan was FAILED (no score)?** FAILED scans are excluded from trend data — only COMPLETED scans with non-null scores are included.
- **What if the trend endpoint is slow?** Sparklines and area charts show loading skeletons. The main dashboard remains interactive since health polling is independent.
- **What if `durationMs` is very large (e.g., 3,600,000ms)?** Format as minutes/seconds: values under 60s show as "Xs", 60s+ show as "Xm Ys".

## Requirements

### Functional Requirements

- **FR-001**: The scan history API (`GET /api/projects/:projectId/health/scans`) MUST include `tokensUsed` and `costUsd` in the select clause and response type
- **FR-002**: A new trend API endpoint (`GET /api/projects/:projectId/health/trends`) MUST return the last N COMPLETED scan scores per active module type, grouped by module
- **FR-003**: The trend endpoint MUST accept a `limit` query parameter (default: 20, max: 100) controlling how many data points per module
- **FR-004**: The trend endpoint MUST return data sorted chronologically (oldest first) per module
- **FR-005**: Each scan history entry MUST display 4 metric icons (AlertTriangle for issues, Coins for cost, Zap for tokens, Clock for duration) with values, hiding any with null data
- **FR-006**: Each metric icon MUST show a descriptive tooltip on hover
- **FR-007**: Active module cards MUST display a sparkline (~40px height, no axes/grid) when 3+ COMPLETED scans exist for that module
- **FR-008**: Active module cards MUST NOT display a sparkline when fewer than 3 completed scans exist
- **FR-009**: Each active module's scan detail drawer MUST include an area chart showing score trend over time, following the Quality Gate drawer's chart pattern
- **FR-010**: Trend data MUST be fetched once on dashboard mount using `useQuery` with no refetch interval (not polled)
- **FR-011**: The Quality Gate module card MUST NOT show a sparkline (it has its own dedicated chart in the drawer)
- **FR-012**: Duration values MUST be formatted as human-readable strings (e.g., "45s", "2m 15s")
- **FR-013**: Cost values MUST be formatted as USD with 2 decimal places (e.g., "$0.15"), or "<$0.01" for sub-cent values
- **FR-014**: Token counts MUST be formatted with compact notation (e.g., "1.2k", "45.3k")

### Key Entities

- **HealthScan** (existing): Already stores `tokensUsed`, `costUsd`, `durationMs` — these fields just need to be exposed
- **ScanHistoryItem** (existing type): Needs `tokensUsed` and `costUsd` fields added
- **TrendDataPoint** (new type): `{ score: number; date: string }` — single score/date pair for charts
- **TrendResponse** (new type): `Record<HealthScanType, TrendDataPoint[]>` — grouped by module type

## Success Criteria

- **SC-001**: Scan history entries show score badge + 4 metric icons (issues, cost, tokens, duration) with tooltips for non-null values
- **SC-002**: `tokensUsed` and `costUsd` are returned by the scan history API in every scan item
- **SC-003**: Active module cards display a sparkline when 3+ completed scans exist; no sparkline otherwise
- **SC-004**: Each active module drawer includes a Recharts area chart showing score trend with axes, dates, and hover tooltip
- **SC-005**: Trend data is fetched once on mount via `GET /api/projects/:projectId/health/trends`, never polled
- **SC-006**: All text in metric icons, tooltips, and charts meets WCAG AA contrast requirements (uses semantic Tailwind tokens)
- **SC-007**: No regression in health dashboard polling performance — trend data is isolated from the 2s polling cycle

## Technical Specification

### Phase 1: API Changes — Scan History Enrichment

**File**: `app/api/projects/[projectId]/health/scans/route.ts`

Add `tokensUsed` and `costUsd` to the Prisma `select` clause in the GET handler (lines 159-175):

```typescript
select: {
  id: true,
  scanType: true,
  status: true,
  score: true,
  issuesFound: true,
  issuesFixed: true,
  baseCommit: true,
  headCommit: true,
  durationMs: true,
  tokensUsed: true,   // NEW
  costUsd: true,      // NEW
  errorMessage: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  report: shouldIncludeReport,
},
```

**File**: `lib/health/types.ts`

Add fields to `ScanHistoryItem` interface:

```typescript
export interface ScanHistoryItem {
  // ... existing fields ...
  durationMs: number | null;
  tokensUsed: number | null;   // NEW
  costUsd: number | null;      // NEW
  errorMessage: string | null;
  // ...
}
```

### Phase 2: API — New Trend Endpoint

**New file**: `app/api/projects/[projectId]/health/trends/route.ts`

```typescript
// GET /api/projects/:projectId/health/trends?limit=20
// Returns: { SECURITY: TrendDataPoint[], COMPLIANCE: [...], TESTS: [...], SPEC_SYNC: [...] }
```

**Implementation**:
1. Validate `projectId` and call `verifyProjectAccess()`
2. Parse `limit` query param (default 20, max 100)
3. Query COMPLETED `HealthScan` records for each active scan type, ordered by `createdAt ASC`, limited to N most recent
4. Use a single Prisma query with `groupBy`-style logic or 4 parallel queries (one per module type)
5. Return response keyed by `HealthScanType`

**Optimal query approach** — single query with post-processing:

```typescript
const scans = await prisma.healthScan.findMany({
  where: {
    projectId,
    status: 'COMPLETED',
    score: { not: null },
    scanType: { in: ['SECURITY', 'COMPLIANCE', 'TESTS', 'SPEC_SYNC'] },
  },
  orderBy: { createdAt: 'desc' },
  select: {
    scanType: true,
    score: true,
    completedAt: true,
    createdAt: true,
  },
});
```

Then group by `scanType`, take last N per group, reverse to chronological order.

**New types** in `lib/health/types.ts`:

```typescript
export interface TrendDataPoint {
  score: number;
  date: string; // ISO date string (completedAt or createdAt)
}

export interface TrendResponse {
  SECURITY: TrendDataPoint[];
  COMPLIANCE: TrendDataPoint[];
  TESTS: TrendDataPoint[];
  SPEC_SYNC: TrendDataPoint[];
}
```

### Phase 3: React Hook — useTrendData

**New file**: `app/lib/hooks/useTrendData.ts`

```typescript
export function useTrendData(projectId: number) {
  return useQuery({
    queryKey: queryKeys.health.trends(projectId),
    queryFn: async (): Promise<TrendResponse> => {
      const response = await fetch(`/api/projects/${projectId}/health/trends`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000,  // 5 minutes — data changes only on scan completion
    gcTime: 10 * 60 * 1000,
  });
}
```

**File**: `app/lib/query-keys.ts` — add:

```typescript
health: {
  // ... existing keys ...
  trends: (projectId: number) => ['health', projectId, 'trends'] as const,
},
```

### Phase 4: UI — Scan History Enrichment

**File**: `components/health/drawer/drawer-history.tsx`

Replace the `HistoryEntry` component to show metric icons instead of "X issues" text:

```typescript
import { AlertTriangle, Coins, Zap, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function HistoryEntry({ scan }: { scan: ScanHistoryItem }) {
  const scoreColors = scan.score !== null ? getScoreColor(scan.score) : null;
  const date = scan.completedAt ?? scan.createdAt;

  return (
    <div className="aurora-glass rounded-md px-3 py-2 flex items-center justify-between">
      <div className="space-y-0.5">
        <p className="text-xs text-foreground">
          {new Date(date).toLocaleDateString()}
        </p>
        {scan.baseCommit && scan.headCommit && (
          <p className="text-[10px] text-muted-foreground font-mono">
            {scan.baseCommit.slice(0, 7)}..{scan.headCommit.slice(0, 7)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <MetricIcons scan={scan} />
        {/* Score badge (unchanged) */}
        {scan.score !== null && scoreColors ? (
          <span className={`text-xs font-medium ${scoreColors.text} ${scoreColors.bg} rounded-md px-2 py-0.5`}>
            {scan.score}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
```

**New `MetricIcons` sub-component** (same file):

```typescript
function MetricIcons({ scan }: { scan: ScanHistoryItem }) {
  const metrics = [
    scan.issuesFound !== null && {
      icon: AlertTriangle,
      value: String(scan.issuesFound),
      tooltip: 'Issues found',
    },
    scan.costUsd !== null && {
      icon: Coins,
      value: formatCost(scan.costUsd),
      tooltip: 'Cost in USD',
    },
    scan.tokensUsed !== null && {
      icon: Zap,
      value: formatTokens(scan.tokensUsed),
      tooltip: 'Tokens consumed',
    },
    scan.durationMs !== null && {
      icon: Clock,
      value: formatDuration(scan.durationMs),
      tooltip: 'Execution time',
    },
  ].filter(Boolean);

  return (
    <>
      {metrics.map((m) => (
        <Tooltip key={m.tooltip}>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <m.icon className="h-3 w-3" />
              {m.value}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {m.tooltip}
          </TooltipContent>
        </Tooltip>
      ))}
    </>
  );
}
```

**Formatting helpers** (new file `lib/health/format.ts`):

```typescript
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  return `${(tokens / 1000).toFixed(1)}k`;
}
```

### Phase 5: UI — Sparklines on Module Cards

**File**: `components/health/health-module-card.tsx`

Add sparkline rendering between the trend indicator and distribution bar. The component receives trend data as a new prop:

```typescript
interface HealthModuleCardProps {
  // ... existing props ...
  trendData?: TrendDataPoint[];  // NEW — from useTrendData hook
}
```

**New `ModuleSparkline` sub-component** (same file):

```typescript
import { LineChart, Line, ResponsiveContainer } from 'recharts';

function ModuleSparkline({ data }: { data: TrendDataPoint[] }) {
  if (data.length < 3) return null;

  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="score"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Render sparkline in the card (after trend indicator, before distribution bar), only for active modules:

```typescript
{!isPassive && trendData && trendData.length >= 3 && (
  <ModuleSparkline data={trendData} />
)}
```

### Phase 6: UI — Area Charts in Active Module Drawers

**File**: `components/health/scan-detail-drawer.tsx`

Add area chart section after the DrawerHeader, before DrawerIssues. Receives trend data as a new prop:

```typescript
interface ScanDetailDrawerProps {
  // ... existing props ...
  trendData?: TrendDataPoint[];  // NEW
}
```

**New `ModuleTrendChart` sub-component** (new file `components/health/drawer/module-trend-chart.tsx`):

```typescript
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { TrendDataPoint } from '@/lib/health/types';

interface ModuleTrendChartProps {
  data: TrendDataPoint[];
}

export function ModuleTrendChart({ data }: ModuleTrendChartProps) {
  if (data.length < 2) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Score Trend</h3>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) =>
                new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              }
              className="text-[10px]"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              domain={[0, 100]}
              className="text-[10px]"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip
              labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
              formatter={(value) => [`${value}`, 'Score']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
              }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary) / 0.1)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

### Phase 7: Dashboard Integration

**File**: `components/health/health-dashboard.tsx`

Wire trend data into the dashboard:

1. Import and call `useTrendData(projectId)` alongside existing hooks
2. Pass `trendData` per module to `HealthModuleCard` components
3. Pass `trendData` for the selected module to `ScanDetailDrawer`

```typescript
const { data: trendData } = useTrendData(projectId);

// In MODULE_GRID map:
<HealthModuleCard
  // ... existing props ...
  trendData={trendData?.[moduleType as HealthScanType]}
/>

// In ScanDetailDrawer:
<ScanDetailDrawer
  // ... existing props ...
  trendData={trendData?.[selectedModule as HealthScanType]}
/>
```

### Implementation Order

1. **Phase 1**: Add `tokensUsed` and `costUsd` to scan history API select + types
2. **Phase 2**: Create trend endpoint (`/api/projects/:projectId/health/trends`)
3. **Phase 3**: Create `useTrendData` hook + query key
4. **Phase 4**: Enrich drawer history with metric icons + formatting helpers
5. **Phase 5**: Add sparklines to module cards
6. **Phase 6**: Add area charts to active module drawers
7. **Phase 7**: Wire trend data through dashboard to cards and drawers
8. **Final**: `bun run type-check && bun run lint && bun run test:unit`

### Files Summary

**New files**:
| File | Purpose |
|------|---------|
| `app/api/projects/[projectId]/health/trends/route.ts` | Trend data endpoint |
| `app/lib/hooks/useTrendData.ts` | TanStack Query hook for trend data |
| `lib/health/format.ts` | Duration, cost, token formatting helpers |
| `components/health/drawer/module-trend-chart.tsx` | Recharts area chart for module drawers |

**Modified files**:
| File | Change |
|------|--------|
| `app/api/projects/[projectId]/health/scans/route.ts` | Add `tokensUsed`, `costUsd` to select |
| `lib/health/types.ts` | Add fields to `ScanHistoryItem`, add `TrendDataPoint`, `TrendResponse` |
| `app/lib/query-keys.ts` | Add `trends` key |
| `components/health/drawer/drawer-history.tsx` | Replace "X issues" with metric icons + tooltips |
| `components/health/health-module-card.tsx` | Add `trendData` prop + sparkline component |
| `components/health/scan-detail-drawer.tsx` | Add `trendData` prop + area chart rendering |
| `components/health/health-dashboard.tsx` | Integrate `useTrendData`, pass data to children |
