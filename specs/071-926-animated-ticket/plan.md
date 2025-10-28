# Implementation Plan: Animated Ticket Background

**Branch**: `071-926-animated-ticket` | **Date**: 2025-10-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/071-926-animated-ticket/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add CSS-only floating ticket animation to the landing page hero section background. 18 semi-transparent ticket cards (64x40px) drift left-to-right over 40-60 seconds with GPU-accelerated transforms, 2px blur, and Catppuccin color palette. Animation adapts responsively (12 tickets tablet, 8 mobile) and respects prefers-reduced-motion for accessibility. Implementation uses TailwindCSS utilities, Next.js server components, and maintains 60fps performance target.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, TailwindCSS 3.4, shadcn/ui
**Storage**: N/A (frontend-only feature, no database changes)
**Testing**: Vitest (unit tests for utility functions), Playwright (E2E visual regression tests)
**Target Platform**: Modern browsers (Chrome, Firefox, Safari) on desktop/tablet/mobile
**Project Type**: Web application (frontend component)
**Performance Goals**: 60fps animation on desktop, 55-60fps on mid-range mobile devices, <200ms page load impact
**Constraints**: CSS-only animation (no JavaScript runtime), GPU-accelerated transforms only (translateX/Y, no top/left), prefers-reduced-motion compliance
**Scale/Scope**: Single landing page component, 18 animated elements max, minimal DOM footprint

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development
**Status**: ✅ PASS
- All code will use TypeScript 5.6 strict mode
- Component props and utility functions will have explicit types
- No `any` types needed (CSS animations don't require type workarounds)

### Principle II: Component-Driven Architecture
**Status**: ✅ PASS
- Will use Server Component pattern for landing page hero section
- No shadcn/ui components needed (decorative background elements only)
- Component location: `/app/(landing)/components/animated-ticket-background.tsx` (feature-based folder)

### Principle III: Test-Driven Development
**Status**: ✅ PASS
- Playwright E2E tests for visual regression (animation presence/absence)
- Playwright tests for prefers-reduced-motion compliance
- Vitest unit tests for any utility functions (color cycling, position calculations if extracted)
- Test-first approach: Write tests for responsive breakpoints before implementation

### Principle IV: Security-First Design
**Status**: ✅ PASS (N/A)
- No user input handling (decorative background only)
- No API endpoints or database queries
- No secrets or sensitive data

### Principle V: Database Integrity
**Status**: ✅ PASS (N/A)
- No database schema changes
- No Prisma migrations needed

### Specification Clarification Guardrails
**Status**: ✅ PASS
- Feature used PRAGMATIC policy (AUTO recommended with high confidence)
- Trade-offs documented in spec (mobile ticket count, abstract content, staggered timing)
- No security/data integrity concerns in clarification decisions

### Technology Standards Compliance
**Status**: ✅ PASS
- Uses mandatory stack: Next.js 15, React 18, TypeScript, TailwindCSS
- No forbidden dependencies added
- Follows Next.js App Router conventions

**GATE RESULT**: ✅ ALL CHECKS PASS - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
app/
├── (landing)/                          # Landing page route group
│   ├── page.tsx                        # Landing page (update to include AnimatedTicketBackground)
│   └── components/
│       └── animated-ticket-background.tsx  # NEW: Background animation component
│
└── globals.css                         # Update with @keyframes for ticket drift animation

tests/
├── e2e/
│   └── landing-animation.spec.ts       # NEW: Visual regression and accessibility tests
└── unit/
    └── animated-ticket-utils.test.ts   # NEW: Tests for utility functions (if extracted)
```

**Structure Decision**: This is a Next.js 15 web application using App Router conventions. The animated ticket background is a landing page feature, so it belongs in the `app/(landing)/components/` directory following the feature-based organization pattern. The component will be imported by `app/(landing)/page.tsx`. CSS animations will be defined in `app/globals.css` using TailwindCSS `@keyframes` directive or Tailwind's JIT arbitrary properties.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**Status**: ✅ NO VIOLATIONS

This feature does not violate any constitution principles or introduce unnecessary complexity.

---

## Post-Design Constitution Re-Check

*Re-evaluation after Phase 1 design artifacts generated*

### Principle I: TypeScript-First Development
**Status**: ✅ PASS (CONFIRMED)
- `AnimatedTicketBackground` component uses strict TypeScript
- All props interfaces defined (`TicketCardProps`, `AnimatedTicketBackgroundProps`)
- Utility functions have explicit return types (`getTicketProps(): TicketCardProps`)
- No `any` types used
- TailwindCSS config extensions use TypeScript (`Config` type from `tailwindcss`)

### Principle II: Component-Driven Architecture
**Status**: ✅ PASS (CONFIRMED)
- Component location follows convention: `app/(landing)/components/animated-ticket-background.tsx`
- Server Component pattern used (no client-side JavaScript)
- No custom UI primitives created (uses TailwindCSS utilities)
- Feature-based folder structure maintained

### Principle III: Test-Driven Development
**Status**: ✅ PASS (CONFIRMED)
- Playwright E2E tests defined in quickstart (7 test cases)
- Tests cover functional requirements (FR-001 through FR-012)
- Tests written before implementation (RED-GREEN-REFACTOR workflow)
- Test file location: `tests/e2e/landing-animation.spec.ts`
- No unit tests needed (no complex utility functions, simple deterministic randomization)

### Principle IV: Security-First Design
**Status**: ✅ PASS (CONFIRMED)
- No user input handled
- No API endpoints exposed
- No secrets or environment variables
- No XSS risk (static component with no dynamic content from external sources)

### Principle V: Database Integrity
**Status**: ✅ PASS (CONFIRMED)
- No database schema changes
- No Prisma models or migrations
- Frontend-only feature

### Specification Clarification Guardrails
**Status**: ✅ PASS (CONFIRMED)
- PRAGMATIC policy applied with high confidence (0.9)
- Trade-offs documented and justified (mobile ticket count, abstract content)
- No security/data integrity compromises

### Technology Standards Compliance
**Status**: ✅ PASS (CONFIRMED)
- Uses mandatory stack: Next.js 15 (App Router), React 18, TypeScript 5.6, TailwindCSS 3.4
- No new dependencies added
- Follows Tailwind best practices (theme extensions vs inline CSS)
- Server Component pattern (default in Next.js 15)

**POST-DESIGN GATE RESULT**: ✅ ALL CHECKS PASS - Proceed to Phase 2 (Tasks Generation)

---

## Phase Summary

### Phase 0: Research ✅
- **Output**: `research.md`
- **Key Decisions**:
  1. TailwindCSS config extensions for keyframes (vs inline CSS)
  2. GPU acceleration via `transform` + `will-change`
  3. Catppuccin colors integrated into Tailwind theme
  4. CSS media queries for responsive breakpoints (vs client component)
  5. Tailwind `motion-safe:` variant for accessibility

### Phase 1: Design & Contracts ✅
- **Outputs**: `data-model.md`, `contracts/component-api.md`, `quickstart.md`
- **Data Model**: Configuration-as-data pattern (no database entities)
- **Contracts**: Component API contract (props, CSS classes, TailwindCSS config)
- **Quickstart**: TDD workflow (7 E2E tests → implementation → verification)

### Phase 2: Tasks Generation (NOT STARTED)
- **Next Command**: `/speckit.tasks` (generates `tasks.md`)
- **Blocked By**: This plan document must be completed first ✅

---

## Implementation Notes

### File Changes Required

**New Files**:
1. `app/(landing)/components/animated-ticket-background.tsx` - Main component
2. `tests/e2e/landing-animation.spec.ts` - E2E tests

**Modified Files**:
1. `tailwind.config.ts` - Add keyframes, animations, Catppuccin colors
2. `app/globals.css` - Add responsive `:nth-child` hiding rules
3. `app/(landing)/page.tsx` - Import and render `AnimatedTicketBackground`

**Total LOC Estimate**: ~250 lines
- Component: ~100 lines
- Tests: ~80 lines
- Config: ~30 lines
- CSS: ~15 lines
- Page integration: ~5 lines

### Critical Implementation Details

1. **Deterministic Randomization**: Use index-based seeding to avoid hydration mismatch
2. **GPU Acceleration**: MUST use `transform: translate()`, NOT `top/left`
3. **Accessibility**: MUST include `aria-hidden="true"` and `motion-safe:` variant
4. **Responsive**: Render 18 tickets always, hide via CSS (not conditional rendering)

### Testing Strategy

**E2E Tests** (Playwright):
- Ticket count verification (18 total, responsive hiding)
- `pointer-events: none` validation
- `aria-hidden` attribute validation
- `prefers-reduced-motion` compliance
- Visual regression (animation plays/stops)

**No Unit Tests**: Simple deterministic logic, no complex business logic to isolate

### Performance Requirements

- **Desktop**: 60fps (verified in Chrome DevTools Performance tab)
- **Mobile**: 55-60fps (test on real device, not just emulator)
- **Page Load**: <200ms impact (Lighthouse audit)

### Success Metrics (SC-001 to SC-007)

All success criteria from spec.md are testable:
- ✅ SC-001: 60fps framerate (manual verification)
- ✅ SC-002: <200ms page load (Lighthouse)
- ✅ SC-003: Text legibility ≥4.5:1 contrast (WCAG validator)
- ✅ SC-004: Zero pointer interference (E2E test)
- ✅ SC-005: Motion preference compliance (E2E test)
- ✅ SC-006: Responsive ticket counts (E2E test)
- ✅ SC-007: CTA stability ±5% (analytics, post-launch)
