# Quickstart: Redesign Comparison Dialog

## Implementation Order

### Step 1: Score Gauge Component
Create `components/comparison/score-gauge.tsx` — reusable SVG circular gauge.
- SVG circle with `stroke-dasharray` / `stroke-dashoffset`
- CSS transition on mount (respects `prefers-reduced-motion`)
- Color-coded by threshold: green (>=85), blue (70-84), yellow (50-69), red (<50)
- Two sizes: large (hero) and small (participant mini-ring)

### Step 2: Hero Card
Create `components/comparison/comparison-hero-card.tsx`.
- Winner ticket key in large text
- Recommendation summary and key differentiator badges
- Large animated score gauge
- Metadata (generatedAt, sourceTicketKey) as muted text
- Three stat pills: Cost, Duration, Quality Score

### Step 3: Participant Grid
Create `components/comparison/comparison-participant-grid.tsx`.
- Responsive flex-wrap grid of non-winner participant cards
- Each card: rank, ticket key, title, badges, rationale, mini score ring

### Step 4: Stat Cards
Create `components/comparison/comparison-stat-cards.tsx`.
- Four cards: Cost, Duration, Quality Score, Files Changed
- Winner's values prominently displayed
- Micro-bar showing all participants' relative positions

### Step 5: Unified Metrics Table
Create `components/comparison/comparison-unified-metrics.tsx`.
- Merge implementation + operational metrics into single table
- 9 rows: Lines Changed, Files Changed, Test Files Changed, Total Tokens, Input Tokens, Output Tokens, Duration, Cost, Job Count
- Proportional inline bars in each cell
- Sticky first column
- Quality score cell retains popover

### Step 6: Compliance Heatmap
Create `components/comparison/comparison-compliance-heatmap.tsx`.
- Colored grid (no text in cells)
- Green/yellow/red backgrounds by status
- Tooltip on hover/tap with assessment notes
- Sticky first column

### Step 7: Enhanced Decision Points
Modify `components/comparison/comparison-decision-points.tsx` in-place.
- Add colored verdict dot next to title
- Keep verdict summary visible without expanding
- First accordion open by default (already implemented)
- Participant approaches with ticket key badges

### Step 8: Update Viewer
Modify `components/comparison/comparison-viewer.tsx`.
- Remove standalone metadata block
- Replace `ComparisonRanking` with `ComparisonHeroCard` + `ComparisonParticipantGrid`
- Replace `ComparisonMetricsGrid` + `ComparisonOperationalMetrics` with `ComparisonStatCards` + `ComparisonUnifiedMetrics`
- Replace `ComparisonComplianceGrid` with `ComparisonComplianceHeatmap`
- Pass `winnerTicketId` to `ComparisonDecisionPoints`

### Step 9: Update Types
Update `components/comparison/types.ts` with new component prop interfaces.

### Step 10: Remove Deprecated Components
Delete `comparison-ranking.tsx`, `comparison-metrics-grid.tsx`, `comparison-operational-metrics.tsx`, `comparison-compliance-grid.tsx` (replaced by new components).

## Key Patterns to Follow

- **Enrichment states**: Always handle `available`, `pending`, `unavailable` for telemetry/quality data
- **Color tokens**: Use `ctp-green`, `ctp-blue`, `ctp-yellow`, `ctp-red` (never hardcode hex/rgb)
- **Semantic classes**: `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary`, `bg-muted`
- **Sticky columns**: `sticky left-0 z-10 bg-card` pattern (from existing operational metrics)
- **Component composition**: Use shadcn/ui primitives (Card, Badge, Tooltip, Collapsible, Popover)

## Testing Strategy

| Component | Test Type | Location |
|-----------|-----------|----------|
| `ScoreGauge` | Unit | `tests/unit/components/score-gauge.test.tsx` |
| `ComparisonHeroCard` | Component | `tests/unit/components/comparison-hero-card.test.tsx` |
| `ComparisonParticipantGrid` | Component | `tests/unit/components/comparison-participant-grid.test.tsx` |
| `ComparisonStatCards` | Component | `tests/unit/components/comparison-stat-cards.test.tsx` |
| `ComparisonUnifiedMetrics` | Component | `tests/unit/components/comparison-unified-metrics.test.tsx` |
| `ComparisonComplianceHeatmap` | Component | `tests/unit/components/comparison-compliance-heatmap.test.tsx` |
| `ComparisonDecisionPoints` (enhanced) | Component | `tests/unit/components/comparison-decision-points.test.tsx` |
| Full dialog integration | Integration | `tests/integration/comparison/comparison-viewer.test.tsx` |
