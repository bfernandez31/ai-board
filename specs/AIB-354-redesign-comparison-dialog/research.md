# Research: Redesign Comparison Dialog as Mission Control Dashboard

## R1: SVG Circular Score Gauge Implementation

- **Decision**: Build a custom SVG circle gauge using `stroke-dasharray` and `stroke-dashoffset` with a CSS transition for the mount animation. Use `prefers-reduced-motion` media query to skip animation.
- **Rationale**: SVG circles are lightweight, accessible, and don't require external libraries. The `stroke-dashoffset` technique is the standard approach for circular progress indicators. No existing gauge component exists in the codebase, so a new one is needed.
- **Alternatives considered**:
  1. Third-party library (e.g., react-circular-progressbar) — rejected per constitution rule: no UI libs besides shadcn/ui + Radix
  2. Canvas-based gauge — rejected because SVG integrates better with React's declarative model and is more accessible
  3. CSS conic-gradient — rejected due to limited browser support for animation and less precise control

## R2: Score Color Thresholds for Comparison Context

- **Decision**: Use comparison-specific thresholds: green (>=85), blue (70-84), yellow (50-69), red (<50). Create a new `getComparisonScoreColor` helper separate from the existing `getScoreColor` utility.
- **Rationale**: The ticket explicitly specifies 85 as the green boundary (vs 90 in the existing `getScoreColor`). Keeping them separate avoids breaking existing quality score displays throughout the app. The comparison context is self-contained within the dialog.
- **Alternatives considered**:
  1. Reuse existing `getScoreColor` with 90+ threshold — rejected because spec explicitly requests 85+
  2. Modify existing `getScoreColor` — rejected because it would affect all other quality score displays

## R3: Micro-bar and Inline Bar Visualization

- **Decision**: Implement proportional bars using simple `div` elements with percentage-based widths. Width = `(value / maxValue) * 100%`. Best value uses `bg-primary`, others use `bg-muted`.
- **Rationale**: No external charting library needed for simple proportional bars. Using Tailwind semantic tokens (`bg-primary`, `bg-muted`) ensures theme compatibility. Recharts is available but overkill for simple bars.
- **Alternatives considered**:
  1. Recharts BarChart — rejected as too heavyweight for inline single-bar cells
  2. CSS background gradient — rejected for less precise control

## R4: Heatmap Cell Coloring for Compliance

- **Decision**: Use inline Tailwind classes for cell backgrounds: `bg-ctp-green/20` (pass), `bg-ctp-yellow/20` (mixed), `bg-ctp-red/20` (fail), `bg-muted` (missing). Use shadcn Tooltip component for hover notes.
- **Rationale**: The `ctp-*` tokens are already defined in globals.css and used throughout the codebase for score coloring. Adding `/20` opacity keeps cells readable without overpowering. The shadcn Tooltip component is already available in `components/ui/tooltip.tsx`.
- **Alternatives considered**:
  1. Custom tooltip — rejected because shadcn Tooltip already exists
  2. Full opacity backgrounds — rejected for readability and visual balance

## R5: Responsive Card Grid Layout

- **Decision**: Use CSS `flex-wrap` with `gap` for the participant card grid. Cards have a `min-width` to prevent excessive squishing and naturally wrap on smaller viewports.
- **Rationale**: Flexbox wrap handles 2-6 participants gracefully without explicit breakpoint logic. The dialog is already max-width 90vw, providing sufficient space for cards.
- **Alternatives considered**:
  1. CSS Grid with `auto-fill` — viable but flexbox wrap is simpler for variable-count cards
  2. Horizontal scroll — rejected because wrapping gives better visibility

## R6: Sticky First Column in Unified Metrics Table

- **Decision**: Use `sticky left-0` with `z-10` and explicit background color on the first column `<td>` and `<th>` elements. This is already implemented in the existing `ComparisonOperationalMetrics` component.
- **Rationale**: The existing operational metrics table already uses this exact pattern (`sticky left-0 z-10 bg-card`). Reuse the same approach in the unified table.
- **Alternatives considered**: None — proven pattern already in codebase

## R7: Accordion Verdict Dot Colors

- **Decision**: Use inline colored dots (small `div` with `rounded-full`) next to decision point titles. Green dot when `verdictTicketId === winnerTicketId`, yellow when `verdictTicketId` is non-null but doesn't match winner, neutral `bg-muted-foreground/30` when `verdictTicketId` is null.
- **Rationale**: Simple CSS-only approach. Uses existing `ctp-*` tokens for green/yellow. No additional state management needed — verdict matching is derived from props.
- **Alternatives considered**:
  1. Icon-based indicators — rejected for visual noise; a simple dot is cleaner
  2. Border coloring — rejected for less visibility at a glance

## R8: Component Architecture

- **Decision**: Refactor comparison content into new sub-components while preserving the `ComparisonViewer` shell, history sidebar, and loading/error states unchanged. New components:
  - `ComparisonHeroCard` — winner display with score gauge and stat pills
  - `ComparisonParticipantGrid` — non-winner card grid with mini score rings
  - `ComparisonStatCards` — four stat cards with micro-bars
  - `ComparisonUnifiedMetrics` — merged metrics table (replaces both `ComparisonMetricsGrid` and `ComparisonOperationalMetrics`)
  - `ComparisonComplianceHeatmap` — colored grid replacing `ComparisonComplianceGrid`
  - `ComparisonDecisionPoints` — enhanced with verdict dots (modified in-place)
  - `ScoreGauge` — reusable SVG circular gauge (used in hero and participant cards)
- **Rationale**: Feature-folder organization per constitution. Each component maps to a distinct user story. The viewer shell remains stable.
- **Alternatives considered**:
  1. Monolithic single component — rejected for maintainability
  2. Keeping old components and adding new ones — rejected because the spec explicitly replaces the old layout
