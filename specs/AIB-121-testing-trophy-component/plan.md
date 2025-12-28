# Implementation Plan: Testing Trophy Component Testing with React Testing Library

**Branch**: `AIB-121-testing-trophy-component` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-121-testing-trophy-component/spec.md`

## Summary

Add React Testing Library (RTL) component testing to the Testing Trophy architecture. This feature updates the constitution and CLAUDE.md to include RTL component testing guidelines, creates test infrastructure with proper setup/utilities, and adds RTL tests for high-priority interactive components (modals, forms, search).

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: React 18, Next.js 16, @testing-library/react 16.3.0, @testing-library/dom 10.4.1, Vitest 4.0.2
**Storage**: N/A (component testing, no database interaction)
**Testing**: Vitest (unit + integration), happy-dom environment for unit tests, @testing-library/react for component rendering
**Target Platform**: Web (Next.js App Router)
**Project Type**: Web application (Next.js)
**Performance Goals**: Component tests should complete in ~10-50ms each (similar to unit tests)
**Constraints**: Tests must run in happy-dom environment (faster than jsdom), no browser dependency
**Scale/Scope**: ~90+ React components, targeting 5+ high-priority interactive components for initial RTL coverage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All test files will use TypeScript with explicit types |
| II. Component-Driven Architecture | ✅ PASS | Testing existing shadcn/ui components, no new UI primitives |
| III. Test-Driven Development | ✅ PASS | Expands Testing Trophy with RTL component layer (Vitest, not Playwright) |
| IV. Security-First | ✅ N/A | Component tests are isolated, no security implications |
| V. Database Integrity | ✅ N/A | Component tests don't interact with database |
| V. Specification Guardrails | ✅ PASS | Auto-resolved decisions documented in spec with CONSERVATIVE policy |
| VI. AI-First Development | ✅ PASS | Documentation updates to constitution.md and CLAUDE.md only (no tutorials/guides) |

**Gate Status**: ✅ ALL GATES PASS - No violations, proceeding to Phase 0

### Post-Design Re-Check (Phase 1 Complete)

| Principle | Status | Verification |
|-----------|--------|--------------|
| I. TypeScript-First | ✅ PASS | Test utilities and component tests use TypeScript with explicit types |
| II. Component-Driven | ✅ PASS | Tests verify shadcn/ui component behavior, no new UI primitives added |
| III. Test-Driven | ✅ PASS | RTL component layer fits Testing Trophy (Vitest, not Playwright) |
| VI. AI-First | ✅ PASS | Only constitution.md and CLAUDE.md updated, no tutorials/guides created |

**Post-Design Gate Status**: ✅ ALL GATES PASS - Ready for task generation

## Project Structure

### Documentation (this feature)

```
specs/AIB-121-testing-trophy-component/
├── plan.md              # This file
├── research.md          # Phase 0: RTL best practices research
├── data-model.md        # Phase 1: Test infrastructure abstractions
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
# Web application structure (Next.js)
tests/
├── unit/
│   ├── components/                    # NEW: RTL component tests
│   │   ├── new-ticket-modal.test.tsx  # Modal form validation, keyboard
│   │   ├── quick-impl-modal.test.tsx  # Confirmation flow
│   │   ├── delete-confirmation-modal.test.tsx
│   │   ├── ticket-search.test.tsx     # Search input, results
│   │   └── comment-form.test.tsx      # Form submission, shortcuts
│   └── [existing unit tests]          # Pure function tests
├── integration/                       # API/database tests (unchanged)
├── e2e/                              # Playwright browser tests (unchanged)
├── utils/
│   └── component-test-utils.tsx       # NEW: renderWithProviders, helpers
├── fixtures/
│   └── vitest/                        # Existing Vitest setup
└── helpers/                           # Existing test helpers

# Documentation updates
.specify/memory/constitution.md        # Add RTL to Testing Trophy table
CLAUDE.md                              # Add component test patterns
```

**Structure Decision**: Web application with Next.js App Router. Component tests placed in `tests/unit/components/` to run with `bun run test:unit` (Vitest + happy-dom). Shared test utilities in `tests/utils/`.

## Complexity Tracking

*No constitution violations - no entries required.*
