# Implementation Plan: React Testing Library Component Testing Integration

**Branch**: `AIB-119-copy-of-testing` | **Date**: 2025-12-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-119-copy-of-testing/spec.md`

## Summary

Integrate React Testing Library (RTL) component tests into the existing Testing Trophy architecture. This adds a component testing layer using RTL within Vitest's unit test environment (`tests/unit/components/`), providing fast feedback for interactive React components without browser overhead. Key deliverables include test helpers (QueryClient wrapper, mock data factories), RTL tests for high-priority components (board, comments, projects), and documentation updates to constitution and CLAUDE.md.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: React 18, Next.js 16, @testing-library/react 16.3.0, @testing-library/dom 10.4.1, Vitest 4.0.2, happy-dom 20.0.8
**Storage**: N/A (component tests use mock data)
**Testing**: Vitest with happy-dom environment for unit/component tests
**Target Platform**: Node.js 22.20.0, browser-based React components
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Component tests execute in <1ms each (total RTL suite <2s)
**Constraints**: Tests must run in happy-dom (no real browser); mock TanStack Query context required
**Scale/Scope**: ~80 React components, targeting 5+ high-priority components for initial RTL coverage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. TypeScript-First | ✅ PASS | All tests use TypeScript strict mode; type-safe mock data factories planned |
| II. Component-Driven | ✅ PASS | Tests target shadcn/ui-based components; no new UI primitives |
| III. Test-Driven (Testing Trophy) | ✅ PASS | RTL component tests fit between unit and integration layers per Kent C. Dodds |
| IV. Security-First | ✅ PASS | Tests use mock data only; no real credentials or secrets |
| V. Database Integrity | ✅ N/A | Component tests mock data layer; no database access |
| V. Clarification Guardrails | ✅ PASS | Spec includes Auto-Resolved Decisions with policy transparency |

**Gate Result**: PASS - All applicable constitution principles satisfied

## Project Structure

### Documentation (this feature)

```
specs/AIB-119-copy-of-testing/
├── plan.md              # This file
├── research.md          # Phase 0: RTL best practices research
├── data-model.md        # Phase 1: Test helper entities
├── quickstart.md        # Phase 1: Getting started guide
├── contracts/           # Phase 1: Test patterns and interfaces
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
# Web application structure (Next.js App Router)
app/                          # Next.js pages and layouts
├── api/                      # API route handlers
components/                   # React components (target for RTL tests)
├── board/                    # Board components (P1 priority)
├── comments/                 # Comment components (P2 priority)
├── projects/                 # Project components (P3 priority)
└── ui/                       # shadcn/ui primitives
lib/                          # Shared utilities and helpers

tests/
├── unit/
│   ├── components/           # NEW: RTL component tests (this feature)
│   │   ├── helpers/          # Test wrappers and mock factories
│   │   ├── board/            # Board component tests
│   │   ├── comments/         # Comment component tests
│   │   └── projects/         # Project component tests
│   └── [existing unit tests]
├── integration/              # Vitest API/DB tests
└── e2e/                      # Playwright browser tests
```

**Structure Decision**: Component tests added to `tests/unit/components/` to leverage existing happy-dom Vitest environment. Test helpers in `tests/unit/components/helpers/` provide QueryClientProvider wrapper and type-safe mock data factories.

## Complexity Tracking

*No violations - Constitution Check passed without exceptions.*

---

## Constitution Check (Post-Design Re-evaluation)

*Re-evaluated after Phase 1 design artifacts were generated.*

| Principle | Status | Post-Design Evidence |
|-----------|--------|----------------------|
| I. TypeScript-First | ✅ PASS | `contracts/helper-interfaces.ts` defines all types; factories return Prisma-typed entities |
| II. Component-Driven | ✅ PASS | Test structure mirrors component structure (`board/`, `comments/`, `projects/`) |
| III. Test-Driven (Testing Trophy) | ✅ PASS | research.md confirms RTL fits Testing Trophy; quickstart.md documents test type selection |
| IV. Security-First | ✅ PASS | All mock factories use synthetic data; no secrets or credentials in contracts |
| V. Database Integrity | ✅ N/A | No database access in component tests by design |
| V. Clarification Guardrails | ✅ PASS | All decisions documented in research.md with rationale and alternatives |

**Post-Design Gate Result**: PASS - Design artifacts align with constitution principles

---

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Implementation Plan | `specs/AIB-119-copy-of-testing/plan.md` | Complete |
| Research Document | `specs/AIB-119-copy-of-testing/research.md` | Complete |
| Data Model | `specs/AIB-119-copy-of-testing/data-model.md` | Complete |
| Test Patterns Contract | `specs/AIB-119-copy-of-testing/contracts/test-patterns.md` | Complete |
| Helper Interfaces | `specs/AIB-119-copy-of-testing/contracts/helper-interfaces.ts` | Complete |
| Quickstart Guide | `specs/AIB-119-copy-of-testing/quickstart.md` | Complete |
| Agent Context | `CLAUDE.md` (updated) | Complete |
