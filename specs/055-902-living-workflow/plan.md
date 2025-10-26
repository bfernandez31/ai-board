# Implementation Plan: Living Workflow Section

**Branch**: `055-902-living-workflow` | **Date**: 2025-10-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/055-902-living-workflow/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Transform the workflow section on the landing page into an animated mini-Kanban board that demonstrates the 6-stage workflow (INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP) with smooth automatic ticket transitions every 10 seconds. The animation pauses on hover and provides visual drag affordance without functional effects. This marketing/demo feature requires pure frontend implementation using React animations and CSS transitions, matching the visual design of the actual AI Board application.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, TailwindCSS 3.4, Framer Motion (animation library - NEEDS CLARIFICATION: should we use Framer Motion or pure CSS animations?)
**Storage**: N/A (static demo, no data persistence)
**Testing**: Vitest (unit tests for animation logic), Playwright (E2E tests for visual behavior and accessibility)
**Target Platform**: Web browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+), mobile responsive (320px-2560px viewport)
**Project Type**: Web application (frontend-only feature)
**Performance Goals**: 60fps animation smoothness, <100ms hover interaction response, <200ms animation transition duration
**Constraints**: Respect prefers-reduced-motion accessibility setting, no layout shifts during animation, pause animation when section not in viewport (Intersection Observer)
**Scale/Scope**: Single landing page section, 2-3 demo tickets, 6 workflow columns, ~200-300 lines of component code

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- All component code will use TypeScript strict mode
- Props interfaces explicitly typed for MiniKanban, DemoTicket, WorkflowColumn components
- Animation state types defined (TicketPosition, AnimationStatus, etc.)
- No `any` types expected (pure UI component with well-defined state)

### II. Component-Driven Architecture ✅
- Uses shadcn/ui components where applicable (Card, Badge primitives)
- Client Component required (`"use client"` for interactivity and animations)
- Feature-based folder: `/components/landing/mini-kanban.tsx`
- No server logic needed (pure presentation component)

### III. Test-Driven Development ✅
- **Vitest unit tests**: Animation timing logic, position calculations, accessibility helpers
- **Playwright E2E tests**: Visual regression, hover interactions, reduced-motion behavior
- Test files: `tests/unit/mini-kanban-animation.test.ts`, `tests/e2e/landing-page-workflow.spec.ts`
- Red-Green-Refactor cycle for animation state machine

### IV. Security-First Design ✅ (N/A for this feature)
- No user input (static demo component)
- No API calls or data fetching
- No secrets or authentication required
- No security concerns for pure visual demo

### V. Database Integrity ✅ (N/A for this feature)
- No database operations
- No data persistence required
- Demo data hardcoded in component

### Additional Constitution Requirements ✅
- **State Management**: Local `useState` for animation state, no server state
- **TanStack Query**: N/A (no data fetching)
- **Error Handling**: Graceful fallback if animations fail (static display)
- **Accessibility**: `prefers-reduced-motion` support mandatory
- **Testing Strategy**: Hybrid approach - Vitest for pure functions, Playwright for visual behavior

**Gate Result**: ✅ PASS - All applicable constitution principles satisfied. This is a low-risk marketing feature with no security, data, or backend concerns.

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 (research.md, data-model.md, contracts/, quickstart.md)*

### I. TypeScript-First Development ✅
- **Verified**: All interfaces defined in `data-model.md` use TypeScript strict mode
- **Verified**: No `any` types in component props, state, or utility functions
- **Verified**: Zod schemas provide runtime validation for static data
- **Status**: PASS - TypeScript strict mode compliance confirmed

### II. Component-Driven Architecture ✅
- **Verified**: Uses shadcn/ui Card and Badge components (no custom UI primitives)
- **Verified**: Client Component pattern with `"use client"` directive
- **Verified**: Feature-based folder structure `/components/landing/`
- **Verified**: No API routes needed (pure frontend)
- **Status**: PASS - Component architecture follows constitution

### III. Test-Driven Development ✅
- **Verified**: Hybrid testing strategy documented in `quickstart.md`
- **Verified**: Vitest unit tests for pure functions (`animation-helpers.ts`)
- **Verified**: Playwright E2E tests for visual behavior and accessibility
- **Verified**: TDD workflow documented (Red-Green-Refactor)
- **Status**: PASS - Testing strategy complies with hybrid approach

### IV. Security-First Design ✅ (N/A)
- **Verified**: No user input, API calls, or sensitive data
- **Verified**: No security attack surface (static demo component)
- **Status**: PASS - No security concerns for this feature

### V. Database Integrity ✅ (N/A)
- **Verified**: No database operations or Prisma migrations needed
- **Verified**: Data is hardcoded in component (no persistence)
- **Status**: PASS - No database concerns for this feature

### VI. Specification Clarification Guardrails ✅
- **Verified**: AUTO policy applied with PRAGMATIC resolution (spec.md documents confidence and trade-offs)
- **Verified**: No security, data integrity, or testing obligations compromised
- **Verified**: Auto-Resolved Decisions section present in spec.md
- **Status**: PASS - Clarification policy properly applied

### Additional Checks ✅

#### State Management
- **Verified**: Uses React `useState` and `useEffect` only (no external libraries)
- **Verified**: No TanStack Query needed (no server state)
- **Verified**: Local component state (no Context API or global state)
- **Status**: PASS - State management follows constitution

#### Technology Decisions
- **Verified**: CSS Animations chosen over Framer Motion (0KB bundle overhead)
- **Verified**: No forbidden dependencies added
- **Verified**: Browser APIs only (Intersection Observer, Media Query, setInterval)
- **Status**: PASS - Technology choices align with constitution

#### Error Handling
- **Verified**: Graceful fallback documented (static display if animations fail)
- **Verified**: No user-facing errors expected (no API calls or data fetching)
- **Status**: PASS - Error handling appropriate for feature type

#### Accessibility
- **Verified**: `prefers-reduced-motion` support mandatory (research.md, data-model.md)
- **Verified**: Two-tier degradation strategy (full animations vs. fade-only)
- **Verified**: CSS media query approach (zero JavaScript overhead)
- **Status**: PASS - Accessibility requirements met

**Final Gate Result**: ✅✅ PASS - All constitution principles satisfied post-design. No violations detected. Feature ready for Phase 2 (task generation).

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
components/
├── landing/
│   ├── mini-kanban.tsx              # Main animated mini-Kanban component
│   ├── demo-ticket.tsx              # Individual ticket card with drag affordance
│   └── workflow-column.tsx          # Column component (INBOX, SPECIFY, etc.)
└── ui/
    ├── card.tsx                     # Existing shadcn/ui Card component
    └── badge.tsx                    # Existing shadcn/ui Badge component

lib/
├── hooks/
│   ├── use-animation-state.ts       # Custom hook for ticket animation state machine
│   └── use-reduced-motion.ts        # Hook to detect prefers-reduced-motion
└── utils/
    └── animation-helpers.ts         # Pure functions for position calculations

app/
└── page.tsx                         # Landing page (imports MiniKanban component)

tests/
├── unit/
│   ├── mini-kanban-animation.test.ts       # Vitest: Animation timing logic
│   ├── animation-helpers.test.ts           # Vitest: Position calculation functions
│   └── use-reduced-motion.test.ts          # Vitest: Accessibility hook logic
└── e2e/
    └── landing-page-workflow.spec.ts       # Playwright: Visual behavior, hover, a11y
```

**Structure Decision**: Web application (Next.js App Router). This feature is a pure frontend component added to the existing landing page. All components follow the established `/components/[feature]/` pattern. Testing follows the hybrid strategy with Vitest for pure utility functions and Playwright for visual/interaction testing.

## Complexity Tracking

*No constitution violations detected. This section is empty.*
