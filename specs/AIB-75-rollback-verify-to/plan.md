# Implementation Plan: Rollback VERIFY to PLAN

**Branch**: `AIB-75-rollback-verify-to` | **Date**: 2025-11-23 | **Spec**: [specs/AIB-75-rollback-verify-to/spec.md](spec.md)
**Input**: Feature specification from `/specs/AIB-75-rollback-verify-to/spec.md`

## Summary

Enable users to roll back tickets from VERIFY to PLAN stage for FULL workflows, reverting implementation changes while preserving specification files. This requires a confirmation modal (similar to BUILD to INBOX rollback), validation of job status (COMPLETED/FAILED/CANCELLED), clearing preview URLs, deleting the job record, and providing visual drag-drop feedback.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 15 (App Router), React 18, TanStack Query v5.90.5, @dnd-kit, shadcn/ui, Prisma 6.x
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit tests), Playwright (integration/E2E tests)
**Target Platform**: Web application (Vercel deployment)
**Project Type**: web (Next.js App Router with API routes)
**Performance Goals**: <100ms UI response for drag-drop feedback, <30s total rollback completion
**Constraints**: Must maintain data integrity via transactions, must not affect running workflows
**Scale/Scope**: Single-tenant project board, ~10-100 tickets per project

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All code in strict TypeScript with explicit types |
| II. Component-Driven | PASS | Use existing shadcn/ui AlertDialog pattern for confirmation modal |
| III. Test-Driven Development | PASS | Unit tests (Vitest) for validators, Playwright for E2E flow |
| IV. Security-First Design | PASS | Use Zod validation for API inputs, Prisma transactions |
| V. Database Integrity | PASS | Atomic transactions for rollback, preserve referential integrity |
| V. Specification Clarification | PASS | Auto-resolved decisions documented in spec with trade-offs |

**Gate Result**: PASS - No violations, proceed with research.

## Project Structure

### Documentation (this feature)

```
specs/AIB-75-rollback-verify-to/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```
# Next.js Web Application Structure (existing patterns)
app/
├── api/
│   └── projects/[projectId]/tickets/[id]/
│       └── transition/route.ts    # MODIFY: Add VERIFY→PLAN rollback logic

components/
├── board/
│   ├── board.tsx                  # MODIFY: Add drag-drop handler for VERIFY→PLAN
│   ├── stage-column.tsx           # MODIFY: Add rollback drop zone styling
│   └── rollback-verify-modal.tsx  # CREATE: Confirmation modal

lib/
├── stage-transitions.ts           # MODIFY: Extend isValidTransition()
└── workflows/
    └── rollback-validator.ts      # MODIFY: Add canRollbackToPlan() function

tests/
├── unit/
│   └── rollback-validator.test.ts # CREATE: Vitest unit tests for validators
├── integration/
│   └── verify-plan-rollback.spec.ts # CREATE: Playwright integration tests
└── e2e/
    └── verify-rollback.spec.ts    # CREATE: Playwright E2E tests
```

**Structure Decision**: Extends existing web application structure following established patterns from BUILD→INBOX rollback implementation.

## Complexity Tracking

*No violations to justify - implementation follows existing patterns.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | - | - |
