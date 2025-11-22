# Implementation Plan: Clean Workflow

**Branch**: `090-1492-clean-workflow` | **Date**: 2025-11-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/090-1492-clean-workflow/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature adds a new "Clean Workflow" using a **diff-based approach** to automatically analyze and fix technical debt. Instead of analyzing individual branches, it examines all changes since the last cleanup merge point. The system provides a menu option to trigger cleanup, creates a specialized CLEAN ticket type with `cleanup-tasks.md` for progress tracking, and executes automated analysis of code, tests, and documentation. The workflow is **project-agnostic** (reads CLAUDE.md and constitution for context) and **only runs impacted tests** (never the full test suite). Stage transitions are prevented during execution via `activeCleanupJobId` lock.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, TanStack Query v5.90.5, @anthropic-ai/claude-code CLI
**Storage**: PostgreSQL 14+ (via Prisma ORM)
**Testing**: Vitest (unit tests), Playwright (E2E tests)
**Target Platform**: Web application (Vercel deployment), GitHub Actions workflows (ubuntu-latest runners)
**Project Type**: Web (Next.js App Router with backend API routes)
**Performance Goals**: Workflow execution <10 minutes, transition locks applied within 2 seconds, UI updates via 2-second polling
**Constraints**: Must not break existing QUICK/FULL workflow types, must preserve ticket access during cleanup, must handle concurrent workflow prevention
**Scale/Scope**: Single project per cleanup workflow, analyzing 1-50 shipped branches typically, affects all tickets in project during transition lock

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development ✅
- All code will use TypeScript strict mode with explicit type annotations
- New WorkflowType enum value (CLEAN) will be explicitly typed
- Transition lock state management will use TypeScript interfaces
- API responses and database models will have corresponding TypeScript interfaces

**Status**: PASS - Standard TypeScript practices apply

### Principle II: Component-Driven Architecture ✅
- Menu option will use shadcn/ui dropdown menu components
- UI indicators for locked transitions will use shadcn/ui alert/badge components
- Server Components by default, Client Components only for interactive cleanup trigger
- API routes follow `/app/api/projects/[projectId]/clean/route.ts` convention
- Transition lock logic in `/lib/transition-lock.ts` utility

**Status**: PASS - Follows established patterns

### Principle III: Test-Driven Development ✅
- Will search for existing test files before creating new ones
- Vitest unit tests for transition lock utility functions
- Playwright E2E tests for cleanup workflow trigger and execution
- Tests for preventing transitions during cleanup
- Tests for allowing content updates during cleanup
- Red-Green-Refactor cycle mandatory

**Status**: PASS - Hybrid testing strategy applies

### Principle IV: Security-First Design ✅
- Input validation via Zod for cleanup trigger API
- Prisma parameterized queries for fetching shipped branches
- Workflow API token authentication for status updates
- No sensitive data exposed in cleanup ticket description (only branch names)
- Environment variables for API tokens (WORKFLOW_API_TOKEN)

**Status**: PASS - Security requirements met

### Principle V: Database Integrity ✅
- Schema changes via `prisma migrate dev` for new WorkflowType.CLEAN enum
- Potential new model for transition locks (or project-level field)
- Transactions for creating cleanup ticket + job + applying lock
- Soft deletes not applicable (tickets remain permanent)
- Database constraints enforced at schema level

**Status**: PASS - Standard migration workflow applies

### Principle VI: Specification Clarification Guardrails ✅
- Feature spec already includes AUTO → CONSERVATIVE fallback decisions
- Clarifications documented in spec.md Auto-Resolved Decisions section
- No PRAGMATIC compromises on security or testing

**Status**: PASS - Spec quality requirements met

### Overall Gate Status: ✅ PASS
No constitution violations. Feature follows all established principles and patterns.

---

## Post-Design Constitution Re-Check

**Date**: 2025-11-21 (after Phase 1 completion)

### Principle I: TypeScript-First Development ✅
**Re-validation**: All design artifacts use explicit TypeScript types
- API contracts define request/response schemas
- Data model uses Prisma schema with type safety
- No `any` types in quickstart examples
- Zod validation schemas for input validation

**Status**: PASS - TypeScript-first maintained throughout design

### Principle II: Component-Driven Architecture ✅
**Re-validation**: UI components follow shadcn/ui patterns
- `CleanupConfirmDialog` uses AlertDialog from shadcn/ui
- `CleanupInProgressBanner` uses Alert component
- Server Components by default, Client Components marked with 'use client'
- API routes follow Next.js conventions (`/app/api/projects/[projectId]/clean/route.ts`)

**Status**: PASS - Architecture principles maintained

### Principle III: Test-Driven Development ✅
**Re-validation**: Comprehensive test strategy defined
- Unit tests: `tests/unit/cleanup-lock.test.ts` (Vitest)
- Integration tests: `tests/integration/cleanup-workflow.spec.ts` (Playwright)
- E2E tests: `tests/e2e/cleanup-feature.spec.ts` (Playwright)
- Test-first approach in quickstart (write tests before implementation)
- Hybrid testing strategy (Vitest for utilities, Playwright for workflows)

**Status**: PASS - TDD requirements met

### Principle IV: Security-First Design ✅
**Re-validation**: Security controls in place
- `verifyProjectAccess()` authorization in cleanup API
- Zod schema validation for inputs
- Prisma parameterized queries (no raw SQL)
- WORKFLOW_API_TOKEN for workflow authentication
- No sensitive data in cleanup ticket descriptions (only branch names)

**Status**: PASS - Security requirements met

### Principle V: Database Integrity ✅
**Re-validation**: Migration and transaction patterns correct
- Schema changes via `prisma migrate dev` (documented in quickstart)
- Atomic transaction for ticket + job + lock creation
- Foreign key relationship for `activeCleanupJobId`
- Indexed fields for query performance
- Backward compatible migration (nullable field)

**Status**: PASS - Database integrity maintained

### Principle VI: Specification Clarification Guardrails ✅
**Re-validation**: Design process followed guardrails
- Research phase resolved all NEEDS CLARIFICATION items
- Design decisions documented with rationales
- No PRAGMATIC compromises on security/testing
- Trade-offs documented in research.md

**Status**: PASS - Guardrails followed

### Final Gate Status: ✅ PASS (Confirmed Post-Design)
No violations introduced during design phase. Implementation ready to proceed.

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
├── api/
│   └── projects/
│       └── [projectId]/
│           ├── clean/
│           │   └── route.ts          # POST endpoint to trigger cleanup
│           └── tickets/
│               └── [ticketId]/
│                   └── transition/
│                       └── route.ts   # PATCH endpoint (add lock check - 423 Locked)

components/
├── cleanup/
│   ├── CleanupConfirmDialog.tsx      # Confirmation dialog for cleanup trigger
│   └── CleanupInProgressBanner.tsx   # Warning banner during cleanup
├── project/
│   └── ProjectMenu.tsx               # Dropdown menu with "Clean Project" option
└── ui/
    └── alert.tsx                     # Alert component (warning variant)

lib/
├── db/
│   └── cleanup-analysis.ts           # Utilities: shouldRunCleanup, getLastCleanupInfo
└── transition-lock.ts                # Utility functions for lock management

prisma/
└── schema.prisma                     # WorkflowType.CLEAN enum, activeCleanupJobId field

.github/
└── workflows/
    └── cleanup.yml                   # Cleanup workflow (diff-based)

.specify/
└── scripts/
    └── bash/
        └── create-new-feature.sh     # Updated with --mode=cleanup

.claude/
└── commands/
    └── cleanup.md                    # Claude command for cleanup execution
```

**Structure Decision**: Web application structure (Option 2). Feature adds new API routes, UI components, GitHub workflow, and database schema changes. Follows Next.js App Router conventions with feature-based organization.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations - this section intentionally left empty.
