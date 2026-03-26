# Implementation Plan: Redesign Comparison Dialog as Mission Control Dashboard

**Feature Branch**: `AIB-354-redesign-comparison-dialog`
**Created**: 2026-03-26
**Status**: Ready for Implementation

## Technical Context

| Aspect | Details |
|--------|---------|
| **Scope** | UI-only redesign of the comparison dialog content area |
| **Data Source** | Existing `ComparisonDetail` type — no API or schema changes (FR-022) |
| **Framework** | React 18 Client Components, shadcn/ui, TailwindCSS 3.4 |
| **Key Dependency** | `lib/quality-score.ts` for `getScoreColor`, `getScoreThreshold` |
| **Color Tokens** | `ctp-green`, `ctp-blue`, `ctp-yellow`, `ctp-red` (existing in globals.css) |
| **Unchanged** | Dialog shell, history sidebar, loading/error/empty states, API layer |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new components fully typed with explicit interfaces |
| II. Component-Driven | PASS | shadcn/ui primitives (Card, Badge, Tooltip, Collapsible, Popover); feature folder `components/comparison/` |
| III. Test-Driven | PASS | Component tests for each new component; see Testing Strategy |
| IV. Security-First | N/A | No user input, no API changes, read-only display |
| V. Database Integrity | N/A | No schema changes |
| VI. AI-First | PASS | No documentation files generated outside specs/ |

## Architecture Overview

### Current Component Hierarchy
```
ComparisonViewer
├── Metadata box (generatedAt, source, winner)
├── ComparisonRanking (all participants in list)
├── ComparisonMetricsGrid (3 implementation metrics)
├── ComparisonOperationalMetrics (7 operational metrics)
├── ComparisonDecisionPoints (collapsibles)
└── ComparisonComplianceGrid (table with badges)
```

### New Component Hierarchy
```
ComparisonViewer (modified — shell unchanged)
├── ComparisonHeroCard (NEW — winner + score gauge + stat pills + metadata)
├── ComparisonParticipantGrid (NEW — non-winner cards with mini score rings)
├── ComparisonStatCards (NEW — 4 stat cards with micro-bars)
├── ComparisonUnifiedMetrics (NEW — 9-row merged table with inline bars)
├── ComparisonDecisionPoints (MODIFIED — verdict dots + ticket key badges)
└── ComparisonComplianceHeatmap (NEW — colored grid with tooltips)
```

### Components Removed
- `ComparisonRanking` → replaced by `ComparisonHeroCard` + `ComparisonParticipantGrid`
- `ComparisonMetricsGrid` → merged into `ComparisonUnifiedMetrics`
- `ComparisonOperationalMetrics` → merged into `ComparisonUnifiedMetrics`
- `ComparisonComplianceGrid` → replaced by `ComparisonComplianceHeatmap`
- Standalone metadata box → absorbed into `ComparisonHeroCard`

## Implementation Steps

### Step 1: ScoreGauge Component + Comparison Score Utility

**New files**:
- `components/comparison/score-gauge.tsx`

**Details**:
- SVG `<circle>` with `stroke-dasharray` = circumference, `stroke-dashoffset` animated from circumference to target
- CSS transition: `transition: stroke-dashoffset 0.8s ease-out`
- `prefers-reduced-motion`: skip transition, render at final state
- Color helper for comparison context: green (>=85), blue (70-84), yellow (50-69), red (<50)
- Uses existing `ctp-*` CSS variable tokens via `fill` attribute or inline `stroke` style referencing CSS variables
- Props: `score: number`, `size: number`, `strokeWidth: number`, `animated?: boolean`
- Background track circle at `stroke: hsl(var(--muted))` opacity

**Acceptance**: FR-002, FR-006

### Step 2: ComparisonHeroCard

**New files**:
- `components/comparison/comparison-hero-card.tsx`

**Details**:
- Receives winner participant, recommendation, keyDifferentiators, generatedAt, sourceTicketKey
- Large ScoreGauge (size ~120px) with winner's `score`
- Winner ticket key in large bold text
- Recommendation summary paragraph
- Key differentiator `Badge` components
- Metadata line: `Generated {date} · Source: {sourceTicketKey}` as small muted text
- Three stat pills at bottom: Cost (`telemetry.costUsd`), Duration (`telemetry.durationMs`), Quality Score (`quality`)
- Handle enrichment states for stat pills (pending → "Pending", unavailable → "N/A")

**Acceptance**: FR-001, FR-002, FR-003, FR-004

### Step 3: ComparisonParticipantGrid

**New files**:
- `components/comparison/comparison-participant-grid.tsx`

**Details**:
- Receives non-winner participants array
- Flex-wrap container with gap
- Each card: bordered rounded container with
  - Rank number + ticket key (bold)
  - Title (muted)
  - Badges: workflowType, agent (if present), quality threshold
  - Rationale text (muted, truncated if needed)
  - Mini ScoreGauge (size ~40px) with participant's score
- Color-coded score rings per comparison thresholds

**Acceptance**: FR-005, FR-006, FR-019

### Step 4: ComparisonStatCards

**New files**:
- `components/comparison/comparison-stat-cards.tsx`

**Details**:
- Four Card components in a responsive grid (2x2 on mobile, 4x1 on desktop)
- Metrics: Cost, Duration, Quality Score, Files Changed
- Winner's value displayed prominently
- Micro-bar beneath each card: horizontal scale with markers for each participant
  - Marker position = `(value / maxValue) * 100%`
  - Winner marker uses `bg-primary`, others use `bg-muted-foreground/50`
  - Omit markers for pending/unavailable participants
- Handle enrichment states

**Acceptance**: FR-007

### Step 5: ComparisonUnifiedMetrics

**New files**:
- `components/comparison/comparison-unified-metrics.tsx`

**Details**:
- Single table with 9 metric rows:
  1. Lines Changed (from `metrics.linesChanged`, bestIs: lowest)
  2. Files Changed (from `metrics.filesChanged`, bestIs: lowest)
  3. Test Files Changed (from `metrics.testFilesChanged`, bestIs: lowest)
  4. Total Tokens (from `telemetry.totalTokens`, bestIs: lowest)
  5. Input Tokens (from `telemetry.inputTokens`, bestIs: lowest)
  6. Output Tokens (from `telemetry.outputTokens`, bestIs: lowest)
  7. Duration (from `telemetry.durationMs`, bestIs: lowest)
  8. Cost (from `telemetry.costUsd`, bestIs: lowest)
  9. Job Count (from `telemetry.jobCount`, bestIs: lowest)
- Each numeric cell has an inline proportional bar:
  - Width = `(value / maxValueInRow) * 100%`
  - Best value bar: `bg-primary`
  - Other bars: `bg-muted`
  - Text overlaid on bar
- Quality Score row: retain `ComparisonQualityPopover` on click
- Sticky first column: `sticky left-0 z-10 bg-card`
- Enrichment states: pending → spinner/text, unavailable → dash

**Acceptance**: FR-008, FR-009, FR-010, FR-011, FR-018

### Step 6: ComparisonComplianceHeatmap

**New files**:
- `components/comparison/comparison-compliance-heatmap.tsx`

**Details**:
- Grid/table: principle rows x participant columns
- Cell backgrounds by status:
  - `pass` → `bg-ctp-green/20`
  - `mixed` → `bg-ctp-yellow/20`
  - `fail` → `bg-ctp-red/20`
  - Missing → `bg-muted`
- No text in cells — color only
- shadcn `Tooltip` on hover showing `assessment.notes`
- Touch: `TooltipTrigger` wraps the cell for tap support
- Sticky first column for principle names
- Handle case: no compliance data → show unavailable state

**Acceptance**: FR-012, FR-013, FR-018

### Step 7: Enhanced ComparisonDecisionPoints

**Modified file**:
- `components/comparison/comparison-decision-points.tsx`

**Details**:
- Add `winnerTicketId` prop
- Verdict dot next to each title:
  - `verdictTicketId === winnerTicketId` → green dot (`bg-ctp-green`)
  - `verdictTicketId !== null && verdictTicketId !== winnerTicketId` → yellow dot (`bg-ctp-yellow`)
  - `verdictTicketId === null` → neutral dot (`bg-muted-foreground/30`)
  - Dot: `h-2.5 w-2.5 rounded-full` inline before title
- Verdict summary remains visible in trigger area (already implemented)
- First accordion open by default (already implemented via `displayOrder === 0`)
- Participant approaches: wrap ticket key in `Badge` component

**Acceptance**: FR-014, FR-015, FR-016, FR-017

### Step 8: Update ComparisonViewer + Types

**Modified files**:
- `components/comparison/comparison-viewer.tsx`
- `components/comparison/types.ts`

**Details**:
- Update `types.ts` with new prop interfaces for all new components
- In viewer, compute `winner` and `nonWinnerParticipants` from detail:
  ```typescript
  const winner = detail.participants.find(p => p.ticketId === detail.winnerTicketId)!;
  const nonWinners = detail.participants.filter(p => p.ticketId !== detail.winnerTicketId);
  ```
- Replace component tree inside `ScrollArea`:
  - Remove metadata box
  - `<ComparisonHeroCard>` (winner, recommendation, keyDifferentiators, generatedAt, sourceTicketKey)
  - `<ComparisonParticipantGrid>` (nonWinners)
  - `<ComparisonStatCards>` (winner, all participants)
  - `<ComparisonUnifiedMetrics>` (all participants)
  - `<ComparisonDecisionPoints>` (decisionPoints, winnerTicketId)
  - `<ComparisonComplianceHeatmap>` (complianceRows, participants)
- Remove imports for deleted components

**Acceptance**: FR-004, FR-019, FR-021

### Step 9: Cleanup Deprecated Components

**Deleted files**:
- `components/comparison/comparison-ranking.tsx`
- `components/comparison/comparison-metrics-grid.tsx`
- `components/comparison/comparison-operational-metrics.tsx`
- `components/comparison/comparison-compliance-grid.tsx`

**Details**:
- Verify no other imports reference these files
- Remove corresponding exports if any barrel files exist

**Acceptance**: Clean removal, no dead code

## Testing Strategy

### Component Tests (RTL + Vitest)

| Test File | Component | Key Assertions |
|-----------|-----------|----------------|
| `tests/unit/components/score-gauge.test.tsx` | ScoreGauge | SVG renders with correct dashoffset; color matches threshold; reduced-motion skips animation |
| `tests/unit/components/comparison-hero-card.test.tsx` | ComparisonHeroCard | Winner key visible; recommendation text; stat pills show values; metadata text present; handles enrichment states |
| `tests/unit/components/comparison-participant-grid.test.tsx` | ComparisonParticipantGrid | Correct number of cards; rank/key/title visible; score ring colors correct; responsive layout |
| `tests/unit/components/comparison-stat-cards.test.tsx` | ComparisonStatCards | 4 stat cards render; winner values shown; micro-bar markers positioned; handles pending/unavailable |
| `tests/unit/components/comparison-unified-metrics.test.tsx` | ComparisonUnifiedMetrics | 9 metric rows; inline bar widths proportional; best value uses primary color; sticky column; quality popover clickable; handles enrichment states |
| `tests/unit/components/comparison-compliance-heatmap.test.tsx` | ComparisonComplianceHeatmap | Cell colors match status; no text in cells; tooltip shows notes on hover; missing = muted bg; unavailable state handled |
| `tests/unit/components/comparison-decision-points.test.tsx` | ComparisonDecisionPoints (enhanced) | Verdict dots correct colors; first accordion open; summary visible without expanding; ticket key badges in approaches |

### Test Patterns

- **Render helper**: Use `renderWithProviders()` from `tests/utils/component-test-utils.tsx`
- **Query priority**: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`
- **User events**: Use `userEvent` for hover/click interactions
- **Mock data**: Create factory functions for `ComparisonParticipantDetail` with configurable enrichment states
- **Accessibility**: Verify `aria-label` on score gauge SVG, `role="tooltip"` on heatmap tooltips

### Test Decision Rationale

- All components are React components with user interactions → **Component tests** (not E2E)
- No API calls in components (data passed as props) → No integration tests needed for components
- No browser-required features (no OAuth, drag-drop, viewport-dependent) → No E2E tests
- Quality popover already tested in existing `comparison-quality-popover` tests → extend, don't duplicate

## Dependencies

### Internal Dependencies
- `lib/quality-score.ts` — `getScoreColor`, `getScoreThreshold` (existing, unchanged)
- `components/comparison/comparison-quality-popover.tsx` — reused in unified metrics table (unchanged)
- `components/ui/tooltip.tsx` — used in compliance heatmap
- `components/ui/card.tsx`, `components/ui/badge.tsx`, `components/ui/collapsible.tsx` — existing shadcn/ui

### External Dependencies
- None — no new packages required

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SVG gauge rendering inconsistency across browsers | Low | Low | Use standard SVG circle technique, test in Chrome/Firefox/Safari |
| Tooltip touch behavior on mobile | Medium | Low | shadcn Tooltip handles touch natively via Radix primitives |
| Horizontal scroll usability with 6 participants | Low | Medium | Sticky first column + consistent column widths |
| Score threshold inconsistency (85 vs 90) | Low | Low | Isolated to comparison components, clearly documented |

## Artifacts

| Artifact | Path |
|----------|------|
| Feature Spec | `specs/AIB-354-redesign-comparison-dialog/spec.md` |
| Implementation Plan | `specs/AIB-354-redesign-comparison-dialog/plan.md` |
| Research | `specs/AIB-354-redesign-comparison-dialog/research.md` |
| Data Model | `specs/AIB-354-redesign-comparison-dialog/data-model.md` |
| API Contracts | `specs/AIB-354-redesign-comparison-dialog/contracts/no-api-changes.md` |
| Quickstart | `specs/AIB-354-redesign-comparison-dialog/quickstart.md` |
