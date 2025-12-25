# Implementation Plan: Restructure Test Suite to Testing Trophy Architecture

**Branch**: `AIB-116-restructure-test-suite` | **Date**: 2025-12-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-116-restructure-test-suite/spec.md`

## Summary

Migrate the test suite from Playwright-heavy (~92 .spec.ts files) to Kent C. Dodds' Testing Trophy architecture. Vitest will handle API/integration tests (fast, ~50ms per test) while Playwright remains reserved for browser-required E2E tests only (OAuth, drag-drop, viewport). This restructuring targets 40% reduction in CI test duration while maintaining complete coverage.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Vitest (existing), Playwright (existing), Prisma 6.x, Next.js 16
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest for integration tests (new), Playwright for E2E (existing, reduced scope)
**Target Platform**: Linux CI runners (GitHub Actions), local development
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: <100ms per integration test, <30s total integration suite, 40% CI reduction
**Constraints**: Worker isolation via project IDs [1,2,4,5,6,7], x-test-user-id auth header
**Scale/Scope**: 92 test files migrating to ~30 Vitest integration + ~47 Playwright E2E

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate Evaluation (Pre-Design)

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| I. TypeScript-First | All code in strict TypeScript | ✅ PASS | Test infrastructure uses .ts files with strict mode |
| II. Component-Driven | Feature-based folder structure | ✅ PASS | `tests/integration/` organized by domain |
| III. Test-Driven Development | Hybrid Vitest/Playwright strategy | ✅ PASS | This feature *defines* the new Testing Trophy strategy |
| III. TDD - Search existing tests | Update existing tests first | ✅ PASS | Migration involves refactoring existing tests |
| IV. Security-First | Input validation, no exposed secrets | ✅ PASS | Test auth uses `x-test-user-id` header (existing pattern) |
| V. Database Integrity | Prisma migrations, transactions | ✅ PASS | No schema changes; tests use existing Prisma client |
| V. Clarification Guardrails | AUTO→CONSERVATIVE fallback | ✅ PASS | Spec includes auto-resolved decisions with trade-offs |

### Constitution Alignment

**Changes to Constitution Required** (FR-009):
- Section III (Test-Driven Development) must be updated to reflect Testing Trophy architecture
- Hybrid strategy section updated: Vitest for API/integration, Playwright for browser-only E2E
- Test directory structure updated: `/tests/integration/` for domain-organized API tests

**Changes to CLAUDE.md Required** (FR-010):
- Testing commands section updated with new `bun run test:integration` command
- Test strategy guidance updated to match Testing Trophy pattern

**No Constitution Violations** - this feature improves existing testing principles without contradicting any non-negotiable rules.

## Project Structure

### Documentation (this feature)

```
specs/AIB-116-restructure-test-suite/
├── plan.md              # This file
├── research.md          # Phase 0: Testing Trophy patterns, Vitest best practices
├── data-model.md        # Phase 1: Test entity relationships
├── quickstart.md        # Phase 1: Test migration guide
├── contracts/           # Phase 1: Test helper interfaces
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
tests/
├── fixtures/
│   ├── playwright/              # Existing Playwright fixtures
│   │   ├── auth-fixture.ts
│   │   └── worker-isolation.ts
│   └── vitest/                  # NEW: Vitest integration fixtures
│       ├── setup.ts             # Per-test setup with worker isolation
│       ├── global-setup.ts      # One-time setup (ensure test user exists)
│       └── api-client.ts        # Fetch wrapper with x-test-user-id auth
├── helpers/
│   ├── worker-isolation.ts      # Existing: worker → projectId mapping
│   ├── db-cleanup.ts            # Existing: cleanup utilities
│   └── db-setup.ts              # Existing: test data creation
├── integration/                  # NEW: Vitest API/integration tests
│   ├── projects/                # Domain: project management
│   │   ├── crud.test.ts
│   │   └── settings.test.ts
│   ├── tickets/                 # Domain: ticket lifecycle
│   │   ├── crud.test.ts
│   │   ├── transitions.test.ts
│   │   └── workflows.test.ts
│   ├── comments/                # Domain: comment system
│   │   └── crud.test.ts
│   ├── jobs/                    # Domain: job tracking
│   │   └── status.test.ts
│   └── cleanup/                 # Domain: cleanup workflow
│       └── analysis.test.ts
├── unit/                        # Existing: Vitest unit tests
│   └── *.test.ts
└── e2e/                         # Reduced: Playwright browser-required tests
    ├── auth/                    # OAuth flows (browser-required)
    ├── board/                   # Drag-drop interactions (browser-required)
    ├── keyboard/                # Keyboard navigation (browser-required)
    └── visual/                  # Viewport/responsive (browser-required)
```

**Structure Decision**: Web application pattern with Next.js App Router. Test organization follows Testing Trophy: integration tests in `tests/integration/` organized by domain, E2E tests in `tests/e2e/` for browser-required scenarios only.

## Complexity Tracking

*No constitution violations requiring justification.*

This feature *improves* the testing strategy by aligning with Kent C. Dodds' Testing Trophy architecture. The migration reduces complexity by:
1. Moving 26 API tests from slow Playwright (~500ms each) to fast Vitest (~50ms each)
2. Organizing tests by domain (user behavior) instead of implementation structure
3. Maintaining a single source of truth for worker isolation patterns

---

## Constitution Check (Post-Design)

*Re-evaluation after Phase 1 design artifacts are complete.*

### Gate Evaluation (Post-Design)

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| I. TypeScript-First | All code in strict TypeScript | ✅ PASS | Contracts defined in TypeScript with explicit types |
| II. Component-Driven | Feature-based folder structure | ✅ PASS | Domain-organized test directories confirmed |
| III. Test-Driven Development | Testing Trophy strategy defined | ✅ PASS | research.md + quickstart.md document the new approach |
| III. TDD - Hybrid strategy | Vitest + Playwright separation clear | ✅ PASS | Clear criteria for test type selection documented |
| IV. Security-First | Auth pattern documented | ✅ PASS | API client contract specifies x-test-user-id usage |
| V. Database Integrity | Cleanup patterns defined | ✅ PASS | TestContext contract includes cleanup() method |
| V. Clarification Guardrails | Trade-offs documented | ✅ PASS | research.md lists all alternatives considered |

### Design Artifacts Summary

| Artifact | Purpose | Status |
|----------|---------|--------|
| research.md | Resolve unknowns, document decisions | ✅ Complete |
| data-model.md | Define test entities and relationships | ✅ Complete |
| contracts/api-client.ts | API client interface | ✅ Complete |
| contracts/test-context.ts | Test context interface | ✅ Complete |
| quickstart.md | Developer onboarding guide | ✅ Complete |

### Ready for Task Generation

All constitution gates pass. Design artifacts are complete and consistent. Ready to proceed with `/speckit.tasks` command to generate implementation tasks.
