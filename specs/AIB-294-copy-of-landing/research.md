# Research: Landing Page UX/UI & Accessibility Improvements

**Branch**: `AIB-294-copy-of-landing` | **Date**: 2026-03-16

## Research Task 1: Hardcoded Hex Color Replacement Strategy

**Decision**: Map all hardcoded hex colors to existing Catppuccin Mocha semantic tokens defined in `globals.css`

**Rationale**: The project already has a comprehensive set of `--ctp-*` CSS variables and corresponding Tailwind classes (`ctp-*`). All existing hardcoded hex values map directly to Catppuccin Mocha palette colors:
- `#8B5CF6` → `--ctp-mauve` (violet/purple accent)
- `#6366F1` → `--primary-violet` (indigo accent, already defined)
- `#3B82F6` → `--ctp-blue` (blue accent)
- `#89b4fa` → `--ctp-blue`
- `#a6e3a1` → `--ctp-green`
- `#f9e2af` → `--ctp-yellow`
- `#f5c2e7` → `--ctp-pink`
- `#89dceb` → `--ctp-sky`
- `#6c7086` → `--ctp-overlay-0`
- `#b4befe` → `--ctp-lavender`
- `#f9cb98` → `--ctp-peach`
- `#f2cdcd` → `--ctp-flamingo`
- `#1e1e2e` → `--ctp-base`

**Alternatives considered**: Creating new custom CSS variables — rejected because existing tokens already cover all needed colors.

## Research Task 2: WCAG AA Compliance for Catppuccin Mocha Theme

**Decision**: Use existing semantic tokens with validated contrast ratios; adjust only where contrast falls below AA thresholds

**Rationale**: Catppuccin Mocha's `--ctp-text` (#cdd6f4) on `--ctp-base` (#1e1e2e) provides ~11.5:1 contrast — well above 4.5:1. `--ctp-subtext-0` (#a6adc8) on `--ctp-base` provides ~7.2:1. Most combinations pass. Muted overlays (`--ctp-overlay-0`) on dark backgrounds may need case-by-case validation.

**Alternatives considered**: Switching to a high-contrast theme — rejected per spec requirement to keep existing color palette.

## Research Task 3: Mobile Workflow Section Enhancement

**Decision**: Create a responsive mini-Kanban visualization that works on mobile using a horizontally-scrollable 2-row layout or animated step-through carousel, rather than hiding the demo entirely

**Rationale**: The current approach (`hidden lg:block`) eliminates the key product demo for mobile users. A compact representation using 2-3 visible columns with horizontal scroll maintains the visual impact. The existing `useAnimationState` hook and `MiniKanbanDemo` logic can be adapted for a mobile-optimized layout.

**Alternatives considered**:
1. Keep vertical step list but add animated transitions — rejected because it doesn't convey the Kanban visual metaphor
2. Full 6-column mini demo at smaller scale — rejected because columns become too narrow below 768px

## Research Task 4: Unique Visual Elements Strategy

**Decision**: Introduce 3+ distinctive elements: (1) custom gradient mesh/pattern backgrounds for sections, (2) subtle scroll-triggered fade-in animations using CSS `@keyframes` + IntersectionObserver, (3) refined section dividers with custom SVG shapes or gradient transitions

**Rationale**: These elements create visual distinction without requiring new dependencies. CSS-only animations respect `prefers-reduced-motion`. Section dividers create visual flow. All build on existing patterns (IntersectionObserver hook already exists).

**Alternatives considered**:
1. Framer Motion — rejected (forbidden dependency, adds bundle size)
2. Lottie animations — rejected (requires new dependency)
3. Three.js/WebGL backgrounds — rejected (performance overhead, accessibility concerns)

## Research Task 5: Focus Indicator & Keyboard Navigation Best Practices

**Decision**: Enhance existing `focus-visible` ring styles with increased visibility (3px solid outline with offset), add `tabindex` to card components where needed, ensure skip-to-content link exists

**Rationale**: The existing Button component has good focus styles via shadcn. Other interactive elements (pricing cards, FAQ toggles, workflow demo) need explicit focus management. A skip-to-content link is required for WCAG AA compliance on long pages.

**Alternatives considered**: Custom focus trap library — rejected (unnecessary for a landing page with no modals).

## Research Task 6: Pricing FAQ Accessibility

**Decision**: Ensure PricingFAQ uses proper `aria-expanded`, `aria-controls`, and `role="button"` attributes on trigger elements. Verify shadcn Collapsible exposes these.

**Rationale**: Shadcn's Collapsible component wraps Radix UI's Collapsible which includes `aria-expanded` by default on the trigger. Need to verify this is properly configured and add `aria-controls` linking trigger to content panel if missing.

**Alternatives considered**: Replace with Accordion component — considered but FAQ already works well with Collapsible pattern.
