# Implementation Plan: Landing Page UX/UI & Accessibility Improvements

**Branch**: `AIB-294-copy-of-landing` | **Date**: 2026-03-16 | **Spec**: `specs/AIB-294-copy-of-landing/spec.md`
**Input**: Feature specification from `/specs/AIB-294-copy-of-landing/spec.md`

## Summary

Improve the existing landing page's accessibility (WCAG AA compliance), replace all hardcoded hex colors with semantic Tailwind tokens, create a mobile-responsive workflow visualization, and introduce distinctive visual elements — all while preserving the Catppuccin Mocha color palette and existing section structure.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, TailwindCSS 3.4, shadcn/ui, lucide-react
**Storage**: N/A (frontend-only changes)
**Testing**: Vitest (unit + component), Playwright (E2E for keyboard navigation/viewport)
**Target Platform**: Web (all modern browsers, mobile + desktop)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Page load within 10% of current metrics (SC-009), Lighthouse Accessibility 95+ (SC-006)
**Constraints**: No new dependencies, semantic Tailwind tokens only (no hex/rgb), WCAG AA compliance
**Scale/Scope**: 12 existing component files modified, 0-2 new component files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All components already TypeScript strict, no changes to type safety |
| II. Component-Driven | PASS | Using shadcn/ui exclusively, feature-based folder structure maintained |
| III. Test-Driven | PASS | Will add component tests for accessibility, extend existing test files |
| IV. Security-First | PASS | No user input, no API changes, no secrets involved |
| V. Database Integrity | N/A | No database changes |
| VI. AI-First | PASS | No documentation files at root, all artifacts in specs/ |
| Colors (CLAUDE.md) | PASS | Replacing hardcoded hex → semantic tokens (this is a primary goal) |
| Forbidden Dependencies | PASS | No new dependencies added |

**Gate Result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```
specs/AIB-294-copy-of-landing/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research output
├── data-model.md        # Phase 1 component/entity mapping
├── quickstart.md        # Phase 1 implementation guide
└── tasks.md             # Phase 2 output (created by /ai-board.tasks)
```

### Source Code (repository root)

```
components/landing/
├── hero-section.tsx          # MODIFY: hex colors → tokens, skip-to-content, visual enhancements
├── features-grid.tsx         # MODIFY: hex icon colors → tokens, scroll animations, accessibility
├── workflow-section.tsx      # MODIFY: mobile-responsive demo, remove hidden lg:block
├── pricing-section.tsx       # MODIFY: visual hierarchy, touch targets
├── cta-section.tsx           # MODIFY: hex gradient → tokens, visual enhancements
├── feature-card.tsx          # MODIFY: semantic color prop, aria-label, focus states
├── workflow-step.tsx         # MODIFY: hex stage colors → tokens, aria-label
├── workflow-column-card.tsx  # MODIFY: minor accessibility improvements
├── pricing-card.tsx          # MODIFY: touch targets, contrast verification
├── pricing-faq.tsx           # MODIFY: aria-expanded/controls verification
├── mini-kanban-demo.tsx      # MODIFY: mobile layout adaptation
└── mobile-workflow-demo.tsx  # NEW (if separate mobile layout needed)

app/landing/
├── page.tsx                  # MODIFY: skip-to-content anchor target
└── components/
    └── animated-ticket-background.tsx  # VERIFY: aria-hidden, reduced-motion

app/globals.css               # MODIFY: new animation keyframes, gradient utilities
tailwind.config.ts            # MODIFY: new animation entries if needed

tests/unit/components/
└── landing-accessibility.test.tsx  # NEW: accessibility component tests
```

**Structure Decision**: Web application structure — modifications within existing `components/landing/` and `app/landing/` directories. No new directories required. Testing follows existing patterns in `tests/unit/components/`.

## Implementation Phases

### Phase 1: Standards Compliance (FR-004)
Replace all hardcoded hex/rgb colors with semantic Tailwind tokens across 4 component files. See `data-model.md` for complete color mapping. This is a non-visual change — output should be pixel-identical.

**Files**: `hero-section.tsx`, `features-grid.tsx`, `workflow-step.tsx`, `cta-section.tsx`, `feature-card.tsx`

### Phase 2: Accessibility Foundation (FR-001, FR-002, FR-003, FR-005, FR-008, FR-010)
- Add skip-to-content link in landing page layout
- Audit/fix heading hierarchy across all sections
- Add visible focus indicators (3px solid outline) to all interactive elements
- Ensure `aria-hidden="true"` on all decorative elements
- Verify/add `aria-expanded` + `aria-controls` to PricingFAQ
- Add `aria-label` to FeatureCard icons and WorkflowStep elements
- Verify logical keyboard tab order

**Files**: `app/landing/page.tsx`, `feature-card.tsx`, `workflow-step.tsx`, `pricing-faq.tsx`, all section components

### Phase 3: Motion & Animations (FR-011, FR-012)
- Add scroll-triggered section fade-in using existing IntersectionObserver hook
- Ensure all new animations respect `prefers-reduced-motion` via `motion-safe:` / `motion-reduce:` classes
- Verify content is fully visible/functional when animations disabled
- Add new `@keyframes` to `globals.css` if needed

**Files**: `globals.css`, section components, `tailwind.config.ts`

### Phase 4: Mobile Workflow Enhancement (FR-006, FR-007)
- Replace `hidden lg:block` / `lg:hidden` with responsive layout
- Create mobile-optimized workflow visualization (horizontally-scrollable compact columns or animated carousel)
- Ensure all CTA touch targets >= 44x44px (`min-h-[44px] min-w-[44px]`)
- Test on 375px and 768px viewports

**Files**: `workflow-section.tsx`, `mini-kanban-demo.tsx`, possibly new `mobile-workflow-demo.tsx`

### Phase 5: Visual Uniqueness (FR-009, FR-013)
- Add distinctive section transitions (gradient dividers or SVG shapes)
- Refine typography spacing and visual rhythm
- Add unique decorative elements (gradient mesh patterns, custom border treatments)
- Ensure at least 3 distinctive visual elements per SC-008

**Files**: Section components, `globals.css`

### Phase 6: Testing & Validation
- Component tests for accessibility attributes (Vitest + RTL)
- E2E tests for keyboard navigation flow (Playwright)
- Verify all existing tests still pass
- Run `bun run type-check` and `bun run lint`

**Files**: `tests/unit/components/`, `tests/e2e/`

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Color token mapping produces different visual output | Low | Medium | Visual comparison before/after; hex values map 1:1 to CTP tokens |
| Mobile workflow demo impacts performance | Medium | Medium | Use CSS-only animations where possible; test on throttled connection |
| New animations cause jank on low-end devices | Low | Medium | Use `transform` and `opacity` only (GPU-accelerated); respect reduced-motion |
| Accessibility changes break existing tests | Low | Low | Run existing test suite after each phase |

## Complexity Tracking

No constitution violations — table not applicable.

## Post-Phase 1 Constitution Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | No type safety changes |
| II. Component-Driven | PASS | All components follow shadcn/ui patterns |
| III. Test-Driven | PASS | New tests planned for Phase 6 |
| Colors (CLAUDE.md) | PASS | All hex colors mapped to semantic tokens |
| Forbidden Dependencies | PASS | Zero new dependencies |
