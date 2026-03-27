# Feature Specification: Modernize Comparison Dashboard Visual Design

**Feature Branch**: `AIB-361-modernize-comparison-dashboard`
**Created**: 2026-03-27
**Status**: Draft
**Input**: User description: "Modernize comparison dashboard visual design"

## Auto-Resolved Decisions

- **Decision**: Visual treatment approach - glassmorphism with semi-transparent backgrounds vs. alternative modern design systems (neumorphism, material elevation, etc.)
- **Policy Applied**: AUTO (fallback to CONSERVATIVE)
- **Confidence**: Low (score: 1) - neutral UI feature, no sensitive/compliance/speed signals
- **Fallback Triggered?**: Yes - AUTO promoted to CONSERVATIVE due to confidence < 0.5
- **Trade-offs**:
  1. Glassmorphism requires careful opacity tuning to maintain WCAG AA contrast ratios; CONSERVATIVE approach means prioritizing readability over visual flair when conflicts arise
  2. Using Tailwind semantic tokens exclusively may limit some rgba opacity values; custom CSS properties may be needed for glassmorphism effects
- **Reviewer Notes**: Verify that all semi-transparent backgrounds maintain sufficient contrast with text overlays. Test with screen readers and high-contrast mode.

---

- **Decision**: Participant color assignment strategy - assign by rank position (1st=green, 2nd=blue, etc.) vs. assign by participant identity (consistent color per ticket across comparisons)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (clearly specified in requirements)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Rank-based assignment means the same ticket may appear in different colors across different comparisons (if its rank changes)
  2. Simpler implementation with no state persistence needed
- **Reviewer Notes**: Confirm rank-based coloring is acceptable even when users compare the same tickets multiple times with different results.

---

- **Decision**: Gradient and glow implementation - use inline styles for rgba values vs. extend Tailwind config with custom utilities
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (Tailwind tokens rule is explicit in CLAUDE.md, but glassmorphism requires opacity variants)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Using Tailwind's built-in opacity modifiers (e.g., `bg-ctp-green/10`) keeps everything in the design system
  2. Complex gradients and box-shadows may require inline style attributes for SVG elements specifically
- **Reviewer Notes**: Ensure no hardcoded hex values appear in component code. SVG gradient definitions are acceptable as they cannot use Tailwind classes.

---

- **Decision**: Score gauge implementation - replace conic-gradient CSS approach with SVG ring using gradient stroke
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicitly specified and aligns with existing SVG-based ScoreGauge component)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. SVG gradients provide better cross-browser support and accessibility
  2. Slightly more markup complexity but better control over glow effects via SVG filters
- **Reviewer Notes**: Existing ScoreGauge already uses SVG with stroke-dasharray. Enhancement should extend, not replace, the existing pattern.

## User Scenarios & Testing

### User Story 1 - Viewing a Comparison with Clear Winner (Priority: P1)

A user opens the comparison dashboard to review ticket comparison results. The winning ticket is immediately visually prominent through a hero card with gradient background, glowing score gauge, and bold WINNER badge. The user can instantly identify the winner without reading detailed metrics.

**Why this priority**: The winner hero card is the focal point of the comparison view. If this doesn't stand out, the entire visual modernization fails its primary goal.

**Independent Test**: Can be fully tested by opening any comparison with a declared winner and verifying the hero card has gradient background, SVG gauge with glow, gradient WINNER badge, and colored differentiator pills.

**Acceptance Scenarios**:

1. **Given** a comparison result with a winner, **When** the user opens the comparison view, **Then** the winner hero card displays with a gradient background tinted with the winner's accent color, an SVG score ring with gradient stroke and drop-shadow glow, and a prominent gradient WINNER badge
2. **Given** a comparison result with a winner, **When** the user views the hero card, **Then** key differentiator pills are colored per category with bordered semi-transparent backgrounds, and the recommendation text appears in its own bordered container
3. **Given** a comparison result with a winner, **When** the user views the hero card, **Then** a subtle radial glow orb is visible in the top-left corner of the card

---

### User Story 2 - Distinguishing Participants by Color Identity (Priority: P1)

A user reviews comparison results involving multiple participants. Each participant has a unique, consistent color identity applied across their score gauge, metrics bars, badges, and decision point verdicts. The user can track any participant across all sections by their color.

**Why this priority**: Color identity is the foundation of the visual modernization - it enables users to mentally link data across sections without reading labels.

**Independent Test**: Can be tested by opening a comparison with 3+ participants and verifying each has a distinct color consistently applied across participant cards, stat cards, decision points, and metrics.

**Acceptance Scenarios**:

1. **Given** a comparison with 2-6 participants, **When** the user views participant cards, **Then** each card has a unique accent color applied to its background tint, border, mini score ring, and rank badge
2. **Given** a comparison with ranked participants, **When** the user views any section, **Then** the winner uses green tones, rank 2 uses blue, rank 3 uses purple/mauve, rank 4 uses peach/orange, rank 5 uses pink/flamingo, and rank 6 uses yellow
3. **Given** a comparison with 6 participants, **When** the user views all sections, **Then** each participant's color is consistent across hero card, participant grid, stat cards, decision points, and metrics

---

### User Story 3 - Analyzing Decision Points with Visual Hierarchy (Priority: P2)

A user expands the decision points section to understand which participant won each decision category. Each decision point appears as a distinct card with a colored background tint matching the verdict winner, a glowing dot indicator, and a colored verdict pill badge.

**Why this priority**: Decision points are key to understanding why a winner was chosen, but currently they are plain text lines that are hard to scan.

**Independent Test**: Can be tested by expanding decision points in any comparison and verifying each point has colored card background, glowing dot, and verdict pill badge.

**Acceptance Scenarios**:

1. **Given** a comparison with decision points, **When** the user expands the decision points section, **Then** each decision point renders as an individual card with a background tint matching the verdict winner's accent color
2. **Given** a decision point with a winner verdict, **When** the user views the point, **Then** a glowing dot indicator (with colored box-shadow) appears instead of a plain colored dot, and the verdict is shown as a colored pill badge on the right side

---

### User Story 4 - Comparing Metrics Across Participants (Priority: P2)

A user reviews the unified metrics table to compare performance across participants. Metrics display stacked horizontal bars per participant colored with their accent color gradient. A color legend at the top maps participant colors, and winner values are highlighted in bold with their accent color.

**Why this priority**: Metrics are data-dense and benefit significantly from color-coded bars over monochrome tables.

**Independent Test**: Can be tested by viewing the metrics section of any multi-participant comparison and verifying gradient bars, color legend, and winner highlighting.

**Acceptance Scenarios**:

1. **Given** a comparison with multiple participants, **When** the user views the metrics section, **Then** each metric row shows stacked horizontal bars per participant using their accent color as a gradient fill (solid to transparent)
2. **Given** a comparison with multiple participants, **When** the user views the metrics section, **Then** a color legend at the top shows each participant's name and associated color
3. **Given** a metric where one participant has the best value, **When** the user views that metric row, **Then** the winner's value is displayed in bold with their accent color

---

### User Story 5 - Reviewing Stat Cards with Color Themes (Priority: P2)

A user glances at the stat cards to get a quick overview of cost, duration, quality, and files changed. Each stat card has its own color theme making it easy to distinguish categories at a glance.

**Why this priority**: Stat cards provide at-a-glance summaries, and color differentiation speeds up visual scanning.

**Independent Test**: Can be tested by viewing stat cards in any comparison and verifying each has a unique color theme.

**Acceptance Scenarios**:

1. **Given** the comparison view is open, **When** the user views stat cards, **Then** the Cost card uses yellow tones, Duration uses blue, Quality Score uses green, and Files Changed uses purple for their label text, progress bar gradient, background tint, and border
2. **Given** a stat card, **When** the user views it, **Then** the score value is displayed at 18px with font-weight 800

---

### User Story 6 - Viewing Compliance Heatmap with Status Colors (Priority: P3)

A user reviews the compliance heatmap to see pass/fail status across compliance categories. Cells use subtle colored backgrounds instead of plain text, making status immediately scannable.

**Why this priority**: The heatmap is a secondary data view that benefits from color but is less critical than primary comparison elements.

**Independent Test**: Can be tested by viewing a comparison with compliance data and verifying cells have colored backgrounds matching their status.

**Acceptance Scenarios**:

1. **Given** a comparison with compliance assessment data, **When** the user views the heatmap, **Then** pass cells have subtle green backgrounds, fail cells have subtle red backgrounds, and mixed cells have subtle yellow backgrounds

---

### Edge Cases

- What happens when a comparison has only 2 participants? Only 2 colors are used (green for winner, blue for runner-up), and all visualizations scale down gracefully with no empty color legend entries.
- What happens when a comparison has the maximum 6 participants? All 6 accent colors are assigned, and bars/gauges remain readable without overlapping.
- What happens when a participant has no data for a metric? The bar is omitted (not shown as zero-width) and the value displays as "N/A" in muted text.
- What happens when all participants tie on a metric? No winner highlighting is applied for that metric; all values display in standard weight.
- What happens with very long participant names or ticket keys? Text truncates with ellipsis; color identity (background tint, border) remains visible regardless of text length.
- What happens when the glassmorphism background would cause text contrast to drop below WCAG AA? Text color falls back to full-opacity foreground to ensure 4.5:1 contrast ratio.

## Requirements

### Functional Requirements

- **FR-001**: System MUST apply glassmorphism styling to all comparison card backgrounds using semi-transparent backgrounds (3-4% opacity) with semi-transparent borders (8-10% opacity)
- **FR-002**: System MUST assign a unique accent color to each participant based on their rank position: rank 1 (green), rank 2 (blue), rank 3 (purple/mauve), rank 4 (peach/orange), rank 5 (pink/flamingo), rank 6 (yellow)
- **FR-003**: System MUST apply each participant's accent color consistently across all sections: score gauges, metrics bars, badges, decision point verdicts, and participant cards
- **FR-004**: Winner hero card MUST display a gradient background using the winner's accent color at 12% opacity fading to transparent
- **FR-005**: Score gauge MUST render as an SVG ring with gradient stroke and drop-shadow glow effect
- **FR-006**: Winner badge MUST display with a gradient background pill style
- **FR-007**: Key differentiator pills MUST be colored per category with border and semi-transparent background
- **FR-008**: Recommendation text MUST appear in its own subtle bordered container
- **FR-009**: Hero card MUST include a subtle radial glow orb in the top-left corner
- **FR-010**: Each participant card MUST have its own accent color applied to background tint, border, mini score ring, and rank badge
- **FR-011**: Each stat card MUST have its own color theme: yellow for cost, blue for duration, green for quality, purple for files changed
- **FR-012**: Stat card color theme MUST apply to label text, progress bar gradient, background tint, and border
- **FR-013**: Stat card score values MUST display at 18px with font-weight 800
- **FR-014**: Each decision point MUST render as a card with colored background tint matching the verdict winner's accent color
- **FR-015**: Decision point indicators MUST use glowing dots (colored box-shadow) instead of plain colored dots
- **FR-016**: Decision point verdicts MUST display as colored pill badges on the right side
- **FR-017**: Metrics section MUST display stacked horizontal bars per participant per metric, colored with each participant's accent color as a gradient (solid to transparent)
- **FR-018**: Metrics section MUST include a color legend at the top mapping participant names to their accent colors
- **FR-019**: Metric winner values MUST display in bold with the winner's accent color
- **FR-020**: Compliance heatmap cells MUST use subtle colored backgrounds for pass (green), fail (red), and mixed (yellow) statuses
- **FR-021**: All progress bars and metric bars MUST use gradient fills (solid color to transparent) instead of flat colors
- **FR-022**: Large score values MUST use font-weight 800 with negative letter-spacing
- **FR-023**: Section labels MUST use small uppercase text with increased letter-spacing (tracking)
- **FR-024**: All sections MUST have increased padding and gaps for generous spacing
- **FR-025**: All colors MUST use Tailwind semantic tokens from the existing Catppuccin palette - no hardcoded hex or rgb values in component code
- **FR-026**: All text MUST maintain WCAG AA contrast ratio (4.5:1 minimum) against its background
- **FR-027**: Visual design MUST scale correctly for 2 to 6 participants without layout breaking or colors repeating
- **FR-028**: No layout or structural changes - component hierarchy, data flow, and props MUST remain unchanged

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can identify the comparison winner within 2 seconds of viewing the dashboard (visual prominence test)
- **SC-002**: Users can correctly associate a participant with their data across all sections by color alone (color consistency test across 100% of sections)
- **SC-003**: All text elements maintain a minimum 4.5:1 contrast ratio against their backgrounds (WCAG AA compliance)
- **SC-004**: The comparison view renders correctly with 2, 3, 4, 5, and 6 participants without visual overlap or broken layouts
- **SC-005**: Zero hardcoded color values (hex, rgb, rgba) appear in component source code - all colors derive from the design system tokens
- **SC-006**: No existing automated tests break as a result of the visual changes (zero regression)
- **SC-007**: The component hierarchy and prop interfaces remain identical before and after the change (structural preservation)

## Assumptions

- The existing Catppuccin color palette provides sufficient accent colors for 6 distinct participants via the available tokens (ctp-green, ctp-blue, ctp-mauve, ctp-peach, ctp-pink/ctp-flamingo, ctp-yellow)
- Tailwind's opacity modifier syntax (e.g., `bg-ctp-green/10`) is sufficient for most glassmorphism effects; SVG gradient definitions are the only acceptable exception for inline color values
- The existing ScoreGauge SVG component can be extended with gradient definitions and filter effects without structural changes
- Semi-transparent backgrounds at 3-4% opacity will be visible enough on the dark Catppuccin Mocha base to create the intended depth effect
- Box-shadow glow effects have negligible performance impact at the scale of 6 participants
