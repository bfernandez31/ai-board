# Implementation Plan: Testing Trophy Component Integration

**Branch**: `AIB-117-testing-trophy-component` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-117-testing-trophy-component/spec.md`

## Summary

Integrate component-level integration testing into the Testing Trophy architecture using Vitest with React Testing Library. This extends the existing test infrastructure to cover React components (NewTicketModal, CommentForm, TicketSearch, MentionInput) with fast, isolated tests that verify user interactions without requiring a browser.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: React 18, Next.js 16, @testing-library/react 16.3.0, @testing-library/react-hooks 8.0.1, @tanstack/react-query 5.90.5, Vitest 4.0.2, happy-dom 20.0.8
**Storage**: PostgreSQL 14+ via Prisma ORM (not directly used in component tests)
**Testing**: Vitest (unit + integration), Playwright (E2E browser tests only)
**Target Platform**: Web application (Next.js App Router)
**Project Type**: Web application (frontend + backend monorepo)
**Performance Goals**: Component tests execute in <500ms each (10x faster than E2E equivalent)
**Constraints**: Tests must run in happy-dom environment without browser; must mock TanStack Query hooks and API calls
**Scale/Scope**: 4 priority components (NewTicketModal, CommentForm, TicketSearch, MentionInput) with 3+ tests each

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Evaluation

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All test utilities and component tests will use strict TypeScript with explicit types |
| II. Component-Driven Architecture | ✅ PASS | Tests align with shadcn/ui patterns; testing React components using existing structure |
| III. Test-Driven Development | ✅ PASS | This feature explicitly extends Testing Trophy architecture for component-level tests |
| IV. Security-First Design | ✅ PASS | No security implications; tests mock API responses |
| V. Database Integrity | ✅ PASS | Component tests do not interact with database directly |
| V. Specification Clarification | ✅ PASS | Spec documents AUTO→CONSERVATIVE fallback appropriately |

### Constitution Alignment

**Testing Trophy Compliance**: This feature extends the existing Testing Trophy architecture by adding component integration tests as a new test layer:
- **Location**: `tests/integration/components/` (new directory)
- **Tool**: Vitest with React Testing Library (already installed)
- **Environment**: happy-dom (already configured for unit tests)
- **Speed Target**: <500ms per test (between unit ~1ms and E2E ~5s)

**AI Agent Guidelines Update Required**: Constitution Section III and CLAUDE.md must be updated to include:
- Component integration tests as a distinct category
- When to use component tests vs Vitest integration tests vs E2E
- Test utility patterns for wrapping components with providers

**Gate Result**: ✅ PASS - No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-117-testing-trophy-component/
├── plan.md              # This file
├── research.md          # Phase 0 output - research findings
├── data-model.md        # Phase 1 output - test entities
├── quickstart.md        # Phase 1 output - usage guide
├── contracts/           # Phase 1 output - API contracts
│   ├── render-with-providers.ts
│   └── component-test-patterns.ts
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Existing project structure (Next.js monorepo)
components/
├── board/
│   └── new-ticket-modal.tsx    # Target component
├── comments/
│   ├── comment-form.tsx        # Target component
│   └── mention-input.tsx       # Target component
└── search/
    └── ticket-search.tsx       # Target component

tests/
├── unit/                       # Existing unit tests
├── integration/
│   ├── tickets/                # Existing API tests
│   ├── projects/               # Existing API tests
│   ├── comments/               # Existing API tests
│   ├── jobs/                   # Existing API tests
│   ├── cleanup/                # Existing API tests
│   └── components/             # NEW: Component integration tests
│       ├── new-ticket-modal.test.tsx
│       ├── comment-form.test.tsx
│       ├── ticket-search.test.tsx
│       └── mention-input.test.tsx
├── e2e/                        # Existing E2E tests
├── fixtures/
│   └── vitest/                 # Existing setup
└── helpers/
    ├── test-query-client.ts    # Existing
    └── render-with-providers.tsx  # NEW: Provider wrapper utility

# Documentation updates
.specify/memory/constitution.md  # Update: Add component testing section
CLAUDE.md                         # Update: Add component testing guidelines
```

**Structure Decision**: Web application (Next.js monorepo). Component integration tests will be placed in `tests/integration/components/` following the existing domain-based organization pattern. A new `render-with-providers.tsx` utility will be added to `tests/helpers/`.

## Complexity Tracking

*No violations. Design adheres to all constitution principles.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

---

## Post-Design Constitution Check

*Re-evaluation after Phase 1 design completion.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All contracts and test utilities are TypeScript with explicit types |
| II. Component-Driven Architecture | ✅ PASS | Tests target existing shadcn/ui components; no new UI primitives |
| III. Test-Driven Development | ✅ PASS | Extends Testing Trophy with component layer; organized by domain |
| IV. Security-First Design | ✅ PASS | No security concerns; tests mock all API responses |
| V. Database Integrity | ✅ PASS | Component tests are isolated from database |
| V. Specification Clarification | ✅ PASS | Design aligns with CONSERVATIVE policy approach |

### Constitution Update Requirements

The following files require updates to document the new component testing layer:

1. **`.specify/memory/constitution.md`** - Add component integration tests to Section III:
   - Add row to Testing Trophy table: `| Component | Vitest + RTL | tests/integration/components/ | ~100ms | React component behavior |`
   - Update Test Selection Decision Tree with component test guidance
   - Add component testing to AI Agent Implementation Guidelines

2. **`CLAUDE.md`** - Add component testing section:
   - Add "Component Integration Tests" row to Testing Guidelines table
   - Add "When to Use Component Tests" section
   - Document `renderWithProviders` utility usage

### Gate Result

✅ **PASS** - No violations. Design is complete and ready for task generation.

---

## Generated Artifacts Summary

| Artifact | Path | Status |
|----------|------|--------|
| Implementation Plan | `specs/AIB-117-testing-trophy-component/plan.md` | ✅ Complete |
| Research Document | `specs/AIB-117-testing-trophy-component/research.md` | ✅ Complete |
| Data Model | `specs/AIB-117-testing-trophy-component/data-model.md` | ✅ Complete |
| Quickstart Guide | `specs/AIB-117-testing-trophy-component/quickstart.md` | ✅ Complete |
| API Contracts | `specs/AIB-117-testing-trophy-component/contracts/` | ✅ Complete |
| Agent Context | `CLAUDE.md` | ✅ Updated |

---

## Next Steps

Run `/speckit.tasks` to generate actionable tasks from this plan.
