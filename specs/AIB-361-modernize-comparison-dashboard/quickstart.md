# Quickstart: Modernize Comparison Dashboard Visual Design

**Branch**: `AIB-361-modernize-comparison-dashboard`

## Prerequisites

- Node.js 22.20.0, Bun runtime
- Running dev server: `bun run dev`
- A comparison result with 2+ participants (navigate to any ticket comparison view)

## Implementation Order

### Step 1: Create Accent Color Utility

**File**: `lib/comparison/accent-colors.ts`

Create a pure function `getAccentColorByRank(rank: number): AccentColorSet` that returns static Tailwind class strings for each rank position (1-6). This is the foundation used by all subsequent component changes.

**Verify**: `bun run test:unit -- accent-colors`

### Step 2: Enhance Score Gauge with Gradient + Glow

**File**: `components/comparison/score-gauge.tsx`

Add optional `accentColor` prop (defaults to score-based color). Add SVG `<defs>` with `<linearGradient>` and `<feDropShadow>` filter. Apply gradient stroke and filter to the score arc circle.

**Verify**: `bun run test:unit -- score-gauge`

### Step 3: Modernize Hero Card

**File**: `components/comparison/comparison-hero-card.tsx`

Apply glassmorphism base, gradient background with winner's accent color, radial glow orb, gradient winner badge, bordered recommendation container, colored differentiator pills.

**Verify**: `bun run test:unit -- comparison-hero-card`

### Step 4: Color Participant Grid

**File**: `components/comparison/comparison-participant-grid.tsx`

Apply per-participant accent colors to card background tint, border, rank badge, and mini score ring.

**Verify**: `bun run test:unit -- comparison-participant-grid`

### Step 5: Theme Stat Cards

**File**: `components/comparison/comparison-stat-cards.tsx`

Apply per-stat color themes (yellow/blue/green/purple) to label text, progress bar gradient, background tint, and border. Update score value styling to 18px font-weight-800.

**Verify**: `bun run test:unit -- comparison-stat-cards`

### Step 6: Enhance Decision Points

**File**: `components/comparison/comparison-decision-points.tsx`

Convert each decision point to a styled card with verdict winner's accent color background tint. Replace plain dots with glowing dots (box-shadow). Add verdict pill badges.

**Verify**: `bun run test:unit -- comparison-decision-points`

### Step 7: Upgrade Unified Metrics

**File**: `components/comparison/comparison-unified-metrics.tsx`

Add color legend header mapping participants to colors. Replace flat bars with gradient bars using participant accent colors. Highlight winner values in bold with accent color.

**Verify**: `bun run test:unit -- comparison-unified-metrics`

### Step 8: Polish Compliance Heatmap

**File**: `components/comparison/comparison-compliance-heatmap.tsx`

Ensure consistent subtle colored backgrounds for pass/mixed/fail cells (already partially implemented).

**Verify**: `bun run test:unit -- comparison-compliance-heatmap`

### Step 9: Apply Glassmorphism Base + Spacing

**File**: `components/comparison/comparison-viewer.tsx`

Apply glassmorphism styling to section containers, increase padding and gaps, apply uppercase tracking to section labels.

**Verify**: `bun run test:unit` (all comparison component tests)

### Step 10: Final Verification

```bash
bun run test:unit          # All unit tests pass
bun run type-check         # No TypeScript errors
bun run lint               # No lint errors
```

## Key Constraints

- **No hardcoded colors**: All colors via Tailwind semantic tokens (`ctp-*`)
- **No dynamic class construction**: All Tailwind classes as complete static strings
- **No prop changes**: Component interfaces remain identical
- **No structural changes**: Component hierarchy and data flow unchanged
- **WCAG AA**: All text maintains 4.5:1 contrast ratio
