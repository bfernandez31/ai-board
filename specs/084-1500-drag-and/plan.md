# Implementation Plan: Drag and Drop Ticket to Trash

**Branch**: `084-1500-drag-and` | **Date**: 2025-11-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/084-1500-drag-and/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add drag-and-drop trash zone functionality to enable users to delete tickets from all stages except SHIP. The feature includes a visual trash zone appearing during drag operations, stage-specific confirmation modals detailing what will be deleted (branch, PRs, workflow artifacts), and transactional GitHub cleanup. Implementation extends existing @dnd-kit drag-and-drop system, adds DELETE API endpoint with GitHub integration via Octokit, and uses optimistic TanStack Query mutations for responsive UI updates.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, @dnd-kit/core, @dnd-kit/sortable, @octokit/rest ^22.0.0, TanStack Query v5.90.5, Prisma 6.x, Zod 4.x
**Storage**: PostgreSQL 14+ (Prisma ORM)
**Testing**: Vitest (unit tests for utilities), Playwright (E2E/API tests)
**Target Platform**: Web application (Vercel deployment)
**Project Type**: Web (Next.js full-stack)
**Performance Goals**: Trash zone appears within 100ms of drag start, deletion completes in <10s including GitHub cleanup, 95% success rate on first attempt
**Constraints**: GitHub API rate limits (5000 req/hour authenticated), transactional integrity for deletion (all-or-nothing), SHIP stage tickets cannot be deleted
**Scale/Scope**: Single-board application with ~100-1000 tickets per project, GitHub operations must handle API failures gracefully

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development ✅
- All new components, API routes, and utilities will use TypeScript strict mode
- Explicit types for drag event handlers, GitHub API responses, deletion mutations
- Zod schemas for API validation (DELETE endpoint request/response)
- No `any` types

### Principle II: Component-Driven Architecture ✅
- Use shadcn/ui AlertDialog for confirmation modal
- Extend existing Board component with trash zone droppable
- Feature folder: `/components/board/trash-zone.tsx`, `/components/board/delete-confirmation-modal.tsx`
- API route: `/app/api/projects/[projectId]/tickets/[id]/route.ts` (DELETE method)
- Utility: `/lib/github/delete-branch-and-prs.ts`

### Principle III: Test-Driven Development ✅
- **Search for existing tests first** before creating new files
- Vitest unit tests for pure utility functions:
  - `tests/unit/trash-zone-eligibility.test.ts` (drag eligibility logic)
  - `tests/unit/stage-confirmation-messages.test.ts` (confirmation message generation)
- Playwright E2E tests:
  - Extend `tests/e2e/board-drag-drop.spec.ts` with trash zone scenarios
  - Add `tests/api/tickets-delete.spec.ts` for DELETE endpoint contract tests
- Red-Green-Refactor cycle for all user stories

### Principle IV: Security-First Design ✅
- Zod validation for DELETE request parameters (projectId, ticketId)
- Authorization check: User must be project owner or member
- GitHub token stored in environment variable (GITHUB_TOKEN)
- Prevent deletion of SHIP stage tickets (business logic validation)
- Rate limit handling for GitHub API failures

### Principle V: Database Integrity ✅
- Transactional deletion: GitHub cleanup → Database deletion (all-or-nothing)
- If GitHub API fails, ticket remains in database (no orphaned state)
- Soft delete NOT used for tickets (permanent deletion per spec requirements)
- Foreign key cascade considerations: Jobs, Comments deleted with ticket

### TanStack Query State Management ✅
- Optimistic update: Remove ticket from UI immediately
- Rollback on failure: Restore ticket to original stage if deletion fails
- Invalidate queries: Refresh board after successful deletion
- Mutation hook: `useDeleteTicket()` in `/lib/hooks/mutations/useDeleteTicket.ts`

**GATE VERDICT: PASS** - All constitution principles satisfied. No violations require justification.

---

## Post-Design Constitution Re-evaluation

*Re-checked after Phase 1 (research, data model, contracts, quickstart) - 2025-11-04*

### Principle I: TypeScript-First Development ✅
- ✅ All new files use TypeScript strict mode (utility functions, API route, components, mutation hooks)
- ✅ Explicit types defined: `DeleteTicketSuccessResponse`, `DeleteTicketParamsSchema`, `TrashZoneProps`, `DeleteConfirmationModalProps`
- ✅ Zod schemas for API validation: `deleteTicketParamsSchema` in `lib/schemas/ticket-delete.ts`
- ✅ No `any` types in design (Octokit and Prisma provide full type safety)

### Principle II: Component-Driven Architecture ✅
- ✅ shadcn/ui AlertDialog used for confirmation modal (not custom implementation)
- ✅ Feature folder structure maintained: `/components/board/trash-zone.tsx`, `/components/board/delete-confirmation-modal.tsx`
- ✅ API route follows Next.js 15 App Router conventions: `/app/api/projects/[projectId]/tickets/[id]/route.ts` (DELETE method)
- ✅ Server Component by default, Client Components (`"use client"`) only for interactive components (TrashZone, DeleteConfirmationModal, Board)
- ✅ Utility functions isolated in `/lib/utils/` and `/lib/github/` with single responsibility

### Principle III: Test-Driven Development ✅
- ✅ Hybrid testing strategy documented:
  - Vitest unit tests: `trash-zone-eligibility.test.ts`, `stage-confirmation-messages.test.ts`
  - Playwright API tests: `tickets-delete.spec.ts` (contract validation)
  - Playwright E2E tests: Extended `board-drag-drop.spec.ts` (user flows)
- ✅ Test-first approach mandated in quickstart.md (Phase 1: Write unit tests BEFORE implementing utilities)
- ✅ Red-Green-Refactor cycle documented for all phases
- ✅ Test discovery workflow followed (existing test file `board-drag-drop.spec.ts` extended, not duplicated)

### Principle IV: Security-First Design ✅
- ✅ Input validation: Zod schema `deleteTicketParamsSchema` validates projectId and ticketId (integers, positive)
- ✅ Authorization: `verifyTicketAccess()` checks user is project owner OR member
- ✅ Prisma parameterized queries: `prisma.ticket.delete()` prevents SQL injection
- ✅ GitHub token security: `GITHUB_TOKEN` in environment variable (never client-side), server-side only instantiation
- ✅ Business rule validation: SHIP stage tickets rejected (400 error), active job tickets rejected (400 error)

### Principle V: Database Integrity ✅
- ✅ No schema changes required (operates on existing entities)
- ✅ Transactional deletion: GitHub cleanup → Database deletion (all-or-nothing)
- ✅ Foreign key cascade: Jobs and Comments deleted automatically via Prisma schema constraints (`onDelete: Cascade`)
- ✅ Error handling: GitHub API failure preserves ticket in database (no orphaned state)
- ✅ Hard delete (not soft delete) per spec requirements (no `deletedAt` field needed)

### TanStack Query State Management ✅
- ✅ Optimistic update pattern: `onMutate` removes ticket immediately from cache
- ✅ Rollback on error: `onError` restores snapshot from context
- ✅ Query invalidation: `onSettled` triggers refetch for consistency
- ✅ Mutation hook: `useDeleteTicket()` follows established pattern in `lib/hooks/mutations/`
- ✅ No automatic retry (`retry: false`) for GitHub API failures (user-controlled retry)

### Specification Clarification Guardrails ✅
- ✅ AUTO policy with CONSERVATIVE fallback applied in spec.md
- ✅ Auto-Resolved Decisions documented with confidence scores, trade-offs, and reviewer notes
- ✅ PRAGMATIC mode retained security controls (authorization, validation, transactional integrity)
- ✅ All decisions justified with rationale and alternatives considered

**RE-EVALUATION VERDICT: PASS** - Design phase introduces no new violations. All constitution principles remain satisfied. Ready to proceed to Phase 2 (task generation via `/speckit.tasks`).

## Project Structure

### Documentation (this feature)

```
specs/084-1500-drag-and/
├── spec.md              # Feature specification (already created)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (to be generated)
├── data-model.md        # Phase 1 output (to be generated)
├── quickstart.md        # Phase 1 output (to be generated)
├── contracts/           # Phase 1 output (to be generated)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Next.js 15 App Router structure
app/
├── api/
│   └── projects/
│       └── [projectId]/
│           └── tickets/
│               └── [id]/
│                   └── route.ts                 # Add DELETE method
└── projects/
    └── [projectId]/
        └── board/
            └── page.tsx                          # Board page (existing)

components/
└── board/
    ├── board.tsx                                 # Main board (existing - extend with trash zone)
    ├── trash-zone.tsx                            # NEW: Trash zone droppable component
    ├── delete-confirmation-modal.tsx             # NEW: Confirmation modal
    ├── ticket-card.tsx                           # Existing - drag source
    └── stage-column.tsx                          # Existing - droppable columns

lib/
├── hooks/
│   ├── mutations/
│   │   └── useDeleteTicket.ts                   # NEW: Delete mutation hook
│   └── queries/
│       └── useTickets.ts                        # Existing - will be invalidated
├── github/
│   └── delete-branch-and-prs.ts                 # NEW: GitHub cleanup utility
├── utils/
│   ├── trash-zone-eligibility.ts                # NEW: Check if ticket can be deleted
│   └── stage-confirmation-messages.ts           # NEW: Generate stage-specific messages
└── schemas/
    └── ticket-delete.ts                         # NEW: Zod schemas for DELETE API

tests/
├── unit/
│   ├── trash-zone-eligibility.test.ts           # NEW: Unit tests for eligibility logic
│   └── stage-confirmation-messages.test.ts      # NEW: Unit tests for message generation
├── api/
│   └── tickets-delete.spec.ts                   # NEW: API contract tests for DELETE
└── e2e/
    └── board-drag-drop.spec.ts                  # Existing - extend with trash tests

prisma/
└── schema.prisma                                 # Existing - no changes needed
```

**Structure Decision**: Next.js 15 App Router with co-located API routes. New components follow existing `/components/board/` feature folder. GitHub utility functions in `/lib/github/` for reusability. Mutation hooks follow established `/lib/hooks/mutations/` pattern for TanStack Query integration.

## Complexity Tracking

*No violations to track - Constitution Check passed.*
