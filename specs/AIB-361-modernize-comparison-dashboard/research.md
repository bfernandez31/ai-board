# Research: Modernize Comparison Dashboard Visual Design

**Date**: 2026-03-27 | **Branch**: `AIB-361-modernize-comparison-dashboard`

## Research Topics

### 1. Glassmorphism with Tailwind Semantic Tokens

**Decision**: Use Tailwind opacity modifiers on existing Catppuccin tokens for all glassmorphism effects.

**Rationale**: Tailwind 3.4 supports arbitrary opacity via `bg-ctp-surface0/[0.04]` syntax, which maps directly to the spec's 3-4% background opacity requirement. This avoids hardcoded rgba values while staying within the design system. Border opacity uses `border-ctp-overlay0/10`.

**Alternatives Considered**:
- Custom CSS variables with rgba: Rejected — violates CLAUDE.md rule against hardcoded color values
- `backdrop-blur` glassmorphism: Rejected — performance concern with nested blurred layers; also not specified in the feature spec
- Extended Tailwind config with custom utilities: Unnecessary — built-in opacity modifiers are sufficient

**Key Finding**: The `bg-ctp-surface0/[0.04]` syntax uses Tailwind's JIT compiler and generates classes at build time. The bracket notation `[0.04]` is required for non-standard opacity values (standard stops: 5, 10, 15, 20, etc.).

### 2. SVG Gradient Stroke for Score Gauge

**Decision**: Add inline `<defs>` with `<linearGradient>` and `<filter>` elements inside the existing SVG structure.

**Rationale**: The existing `ScoreGauge` component already uses SVG with `stroke`, `strokeDasharray`, and `strokeDashoffset`. Adding a gradient definition and referencing it via `stroke="url(#gradient-id)"` is the standard SVG approach. Drop-shadow glow uses SVG `<filter>` with `<feDropShadow>`.

**Alternatives Considered**:
- CSS `conic-gradient` overlay: Rejected — spec explicitly calls for SVG ring with gradient stroke
- Canvas-based rendering: Rejected — unnecessary complexity, worse accessibility
- CSS `filter: drop-shadow()` on SVG element: Viable but SVG `<filter>` provides more control over glow radius and color

**Key Finding**: SVG gradient `<stop>` elements require `stop-color` attributes with actual color values. Since these are SVG attributes (not Tailwind classes), using `hsl(var(--ctp-green))` is acceptable — this references the CSS custom property, not a hardcoded hex value. This is the same pattern already used in `score-gauge.tsx` line 18 for `stroke`.

### 3. Accent Color Mapping Strategy

**Decision**: Create a pure utility function that maps rank (1-6) to a complete set of static Tailwind class strings.

**Rationale**: The spec requires rank-based color assignment (rank 1 = green, rank 2 = blue, etc.) applied consistently across 7 components. A centralized mapping avoids duplication and ensures consistency. Returning full static class strings (e.g., `"text-ctp-green"`, `"bg-ctp-green/10"`) satisfies the CLAUDE.md requirement against dynamic class construction.

**Alternatives Considered**:
- Per-component color logic: Rejected — duplicates mapping in 7 files, risk of inconsistency
- CSS custom properties per participant: Rejected — requires runtime style injection, harder to maintain
- Tailwind plugin with custom variants: Over-engineered for 6 static mappings

**Key Finding**: The function must return complete class strings, never fragments. For example, return `{ bgSubtle: "bg-ctp-green/10" }` not `{ color: "green" }` — Tailwind's purger needs the full class in source code.

### 4. Glow Effects Performance

**Decision**: Use CSS `box-shadow` for decision point dots and SVG `<feDropShadow>` for score gauges. No performance concerns at scale.

**Rationale**: Box-shadow is GPU-composited in modern browsers. With a maximum of 6 participants and ~10-15 decision points, the total glow elements are under 100 — well within browser rendering budgets.

**Alternatives Considered**:
- CSS `filter: drop-shadow()`: Works but `box-shadow` is more performant (doesn't trigger full layer repaint)
- Pseudo-element glow (::after with blur): More markup, same visual result
- Animated glow: Not specified, would add unnecessary complexity

**Key Finding**: The radial glow orb on the hero card can use an absolutely positioned div with `bg-ctp-green/10` and `rounded-full blur-3xl` — pure Tailwind, no custom CSS needed.

### 5. WCAG AA Contrast with Semi-Transparent Backgrounds

**Decision**: Text always uses full-opacity foreground colors (`text-foreground`, `text-ctp-text`). Semi-transparent backgrounds at 3-4% opacity have negligible contrast impact on the dark Catppuccin Mocha base (#1e1e2e).

**Rationale**: At 4% opacity, a surface color overlay shifts the effective background by less than 1 luminance unit. The contrast ratio between `ctp-text` (#cdd6f4) and `ctp-base` (#1e1e2e) is ~11.5:1, far exceeding WCAG AA's 4.5:1 requirement. A 4% overlay reduces this to ~11.3:1 — still well above threshold.

**Alternatives Considered**:
- Dynamic contrast checking at runtime: Over-engineered — the math confirms static compliance
- Higher opacity backgrounds with adjusted text: Unnecessary — the base contrast is excellent

**Key Finding**: The only risk area is accent-colored text on accent-tinted backgrounds (e.g., green text on green-tinted card). The solution: accent text uses full-opacity tokens (`text-ctp-green`) while backgrounds use very low opacity (`bg-ctp-green/10` max). At these levels, contrast remains above 4.5:1.

### 6. Tailwind Class String Strategy for Dynamic Rank Colors

**Decision**: Use a lookup object with complete static class strings indexed by rank number. Return the full object from the utility function.

**Rationale**: Tailwind's purger (JIT compiler) scans source files for complete class strings. Dynamic construction like `` `bg-ctp-${color}/10` `` would not be detected. The lookup object approach ensures every class string appears as a literal in the source file.

**Implementation Pattern**:
```typescript
const RANK_COLORS = {
  1: { text: "text-ctp-green", bgSubtle: "bg-ctp-green/10", border: "border-ctp-green/20", ... },
  2: { text: "text-ctp-blue", bgSubtle: "bg-ctp-blue/10", border: "border-ctp-blue/20", ... },
  // ... ranks 3-6
} as const;

export function getAccentColorByRank(rank: number) {
  return RANK_COLORS[rank as keyof typeof RANK_COLORS] ?? RANK_COLORS[6];
}
```

**Key Finding**: The `as const` assertion preserves literal string types, enabling TypeScript to infer exact class strings. Fallback to rank 6 handles any unexpected rank values gracefully.
