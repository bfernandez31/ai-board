# Implementation Plan: React Component Testing with Testing Library

**Branch**: `AIB-120-copy-of-copy` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-120-copy-of-copy/spec.md`

## Summary

Implement React Testing Library (RTL) component testing strategy following the Testing Trophy pattern. Add a Claude skill for component testing guidance, create 3+ representative component tests, and update documentation (constitution.md, CLAUDE.md) to reflect RTL as part of the testing strategy. Infrastructure already exists (RTL and happy-dom installed); focus is on patterns, skill creation, and documentation.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: @testing-library/react 16.3.0, @testing-library/dom 10.4.1, happy-dom 20.0.8, Vitest 4.0.2, React 18.3.1
**Storage**: N/A (testing infrastructure, no database changes)
**Testing**: Vitest for unit tests with happy-dom environment (already configured in vitest.config.mts)
**Target Platform**: Node.js 22.20.0 test environment, React 18 components
**Project Type**: Web application (Next.js 16 App Router)
**Performance Goals**: Component tests must execute in under 100ms each (SC-004)
**Constraints**: Must follow Testing Trophy strategy from constitution; behavior-based testing only (no implementation details)
**Scale/Scope**: 3+ representative components with tests (SC-001); 1 Claude skill; 2 documentation updates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Compliance | Notes |
|-----------|-------------|------------|-------|
| I. TypeScript-First | All code in strict TypeScript | ✅ PASS | Test files use `.test.ts`; all types explicit |
| II. Component-Driven | Use shadcn/ui, feature folders | ✅ N/A | Testing infrastructure, no UI components created |
| III. Test-Driven | Testing Trophy strategy | ✅ PASS | RTL tests fit unit layer for hooks/behavior; existing useJobPolling.test.ts pattern followed |
| IV. Security-First | No user input, no DB queries | ✅ N/A | Testing infrastructure only |
| V. Database Integrity | No schema changes | ✅ N/A | Testing infrastructure only |
| VI. AI-First Development | No human tutorials, use skills | ✅ PASS | Claude skill for guidance; no README/GUIDE files |

**Gate Status**: ✅ PASS - All applicable principles satisfied

## Project Structure

### Documentation (this feature)

```
specs/AIB-120-copy-of-copy/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command) - N/A for this feature
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Next.js App Router structure (existing)
app/
├── api/                 # API routes
├── lib/
│   └── hooks/           # React hooks (tested with RTL)
└── ...

components/              # React components (testing targets)
├── board/
├── tickets/
├── jobs/
└── ...

# Testing structure (existing)
tests/
├── unit/                # Vitest unit tests (RTL tests go here)
│   └── *.test.ts        # Component and hook tests
├── integration/         # Vitest API/DB tests
└── e2e/                 # Playwright browser tests

# Claude commands (new for this feature)
.claude/
└── commands/
    └── component-testing.md  # New RTL testing skill

# Documentation updates
.specify/memory/constitution.md  # Update Testing Trophy section
CLAUDE.md                         # Update testing guidance
```

**Structure Decision**: Web application (Next.js 16 App Router). Tests placed in `tests/unit/components/` following existing patterns. Claude command in `.claude/commands/` per project conventions.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations identified. All constitution principles satisfied.

## Post-Design Constitution Re-Check

*Completed after Phase 1 design finalization*

| Principle | Post-Design Status | Notes |
|-----------|-------------------|-------|
| I. TypeScript-First | ✅ CONFIRMED | All test files use `.test.ts`, explicit types in data-model.md |
| II. Component-Driven | ✅ N/A | No UI components created; testing existing components |
| III. Test-Driven | ✅ CONFIRMED | RTL tests in `tests/unit/components/`; Testing Trophy aligned |
| IV. Security-First | ✅ N/A | No user input handling or database queries |
| V. Database Integrity | ✅ N/A | No schema changes |
| VI. AI-First Development | ✅ CONFIRMED | Claude command for guidance; no README/tutorial files |

**Final Gate Status**: ✅ PASS - Design validated against all constitution principles
