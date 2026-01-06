# Implementation Plan: Close Ticket Feature

**Branch**: `AIB-148-copy-of-close` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-148-copy-of-close/spec.md`

## Summary

Add CLOSED as a terminal stage allowing users to close VERIFY tickets without shipping them, providing a clean resolution path for abandoned or cancelled work. Preserves the git branch but closes associated GitHub PRs and removes the ticket from board display while keeping it searchable.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict)
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, @dnd-kit/core, @dnd-kit/sortable, TanStack Query v5, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E for drag-drop)
**Target Platform**: Web (Vercel deployment)
**Project Type**: web (Next.js App Router)
**Performance Goals**: Close operation < 10 seconds including PR close
**Constraints**: Idempotent PR handling, graceful failure if GitHub API unavailable
**Scale/Scope**: Single project management board, ~100s tickets per project

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All code with strict types, Stage enum extended |
| II. Component-Driven | ✅ PASS | Uses shadcn/ui AlertDialog for close modal, follows existing patterns |
| III. Test-Driven | ✅ PASS | RTL tests for modal, Vitest integration for API, Playwright for drag-drop |
| IV. Security-First | ✅ PASS | Input validation, authorization via verifyTicketAccess |
| V. Database Integrity | ✅ PASS | Prisma migration adds Stage.CLOSED and closedAt field |
| VI. AI-First | ✅ PASS | No documentation files created, follows existing patterns |

**Gate Violations**: None

## Project Structure

### Documentation (this feature)

```
specs/AIB-148-copy-of-close/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```
prisma/
├── schema.prisma        # [MODIFY] Add CLOSED to Stage enum, add closedAt field

lib/
├── stage-transitions.ts # [MODIFY] Add CLOSED stage, terminal state logic
├── github/
│   ├── delete-branch-and-prs.ts  # [EXISTS] Reference for PR close pattern
│   └── close-prs.ts              # [CREATE] PR close without branch deletion
├── types.ts             # [MODIFY] Extend TicketWithVersion if needed

components/board/
├── board.tsx            # [MODIFY] Dual drop zone for SHIP column, CLOSED handling
├── stage-column.tsx     # [MODIFY] Skip CLOSED column rendering
├── close-confirmation-modal.tsx  # [CREATE] Modal for close confirmation
├── ticket-detail-modal.tsx       # [MODIFY] Read-only mode for CLOSED tickets

components/search/
├── ticket-search.tsx    # [MODIFY] Muted styling for closed tickets

app/api/projects/[projectId]/tickets/[id]/
├── route.ts             # [MODIFY] Handle CLOSED stage in responses
├── close/
│   └── route.ts         # [CREATE] POST endpoint for close transition

tests/
├── unit/
│   └── components/
│       └── close-confirmation-modal.test.tsx  # [CREATE]
├── integration/
│   └── tickets/
│       └── close.test.ts  # [CREATE] Close API tests
└── e2e/
    └── ticket-close.spec.ts  # [CREATE] Drag-drop close E2E
```

**Structure Decision**: Web application with Next.js App Router. All changes follow existing directory conventions.

## Complexity Tracking

*No violations requiring justification*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Phase 0: Research Summary

See [research.md](./research.md) for detailed findings.

**Key Decisions**:
1. **Dual Drop Zone Pattern**: Adapt existing Quick-impl pattern (INBOX→BUILD/SPECIFY) for SHIP column (VERIFY→SHIP/CLOSED)
2. **PR Close API**: Create new `closePRsForBranch()` function, similar to existing `deleteBranchAndPRs()` but without branch deletion
3. **Terminal State**: CLOSED is terminal like SHIP - `isTerminalStage()` updated to include CLOSED
4. **Read-Only Modal**: Reuse existing `canEditDescriptionAndPolicy()` pattern, extend for CLOSED stage
5. **Search Styling**: Add "Closed" badge and muted opacity (60%) to search results

## Phase 1: Design Artifacts

### Data Model

See [data-model.md](./data-model.md) for entity definitions.

**Key Changes**:
- `Stage` enum: Add `CLOSED` value
- `Ticket` model: Add optional `closedAt DateTime?` field
- State machine: VERIFY → CLOSED valid transition, CLOSED has no outbound transitions

### API Contracts

See [contracts/](./contracts/) for OpenAPI specifications.

**Endpoints**:
- `POST /api/projects/{projectId}/tickets/{id}/close` - Close ticket from VERIFY stage

### Quickstart

See [quickstart.md](./quickstart.md) for implementation guide.

**Critical Files (in implementation order)**:
1. `prisma/schema.prisma` - Schema changes
2. `lib/stage-transitions.ts` - State machine updates
3. `lib/github/close-prs.ts` - GitHub PR close function
4. `app/api/projects/[projectId]/tickets/[id]/close/route.ts` - Close API
5. `components/board/close-confirmation-modal.tsx` - Close modal
6. `components/board/board.tsx` - Dual drop zone and close flow
7. `components/board/stage-column.tsx` - Skip CLOSED column
8. `components/search/ticket-search.tsx` - Closed ticket styling
9. `components/board/ticket-detail-modal.tsx` - Read-only for CLOSED
