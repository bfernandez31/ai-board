# Implementation Plan: Close Ticket Feature

**Branch**: `AIB-147-close-ticket-feature` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-147-close-ticket-feature/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add CLOSED state as a new terminal stage for tickets in VERIFY stage, allowing users to cleanly abandon work without shipping. Implements dual drop zone UX (Ship/Close) when dragging from VERIFY to SHIP, closes associated GitHub PRs while preserving branches, and includes search integration for closed tickets with read-only mode.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, @dnd-kit/core, @octokit/rest, TanStack Query v5, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E for drag-drop interactions)
**Target Platform**: Web application (Linux server / Vercel deployment)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Ticket closure in <30 seconds, PR closure within 10 seconds of confirmation
**Constraints**: Branch preservation on closure (no deletion), idempotent PR closure operations
**Scale/Scope**: Single project board, existing ticket search integration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gates

| Gate | Status | Evidence |
|------|--------|----------|
| TypeScript strict mode | ✅ PASS | `tsconfig.json` has `strict: true` |
| No `any` types | ✅ PASS | Will use explicit types for all new code |
| Prisma migrations | ✅ PASS | Schema changes via `prisma migrate dev` |
| shadcn/ui components | ✅ PASS | Modal dialogs use existing AlertDialog component |
| Testing Trophy | ✅ PASS | Unit for validation, Integration for API, E2E for drag-drop |
| Input validation | ✅ PASS | Zod schemas for transition endpoint |
| TanStack Query | ✅ PASS | Existing mutation patterns for state updates |

### Post-Design Gates (Re-evaluated after Phase 1)

| Gate | Status | Evidence |
|------|--------|----------|
| E2E only for browser-required | ✅ PASS | Dual drop zone requires DnD Kit (browser-only); API tests use Vitest integration |
| No custom UI primitives | ✅ PASS | CloseConfirmationModal uses AlertDialog from shadcn/ui; CloseZone uses standard div with Tailwind |
| Transaction integrity | ✅ PASS | Database update (stage, closedAt) is atomic; PR closure is best-effort with retry logic |
| Read-only mode | ✅ PASS | Extends existing TicketDetailModal with `isReadOnly` prop based on stage |
| Search integration | ✅ PASS | Existing search endpoint returns all stages; client handles CLOSED styling |

## Project Structure

### Documentation (this feature)

```
specs/AIB-147-close-ticket-feature/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Next.js App Router (Web Application)
prisma/
├── schema.prisma        # MODIFY: Add CLOSED to Stage enum, closedAt to Ticket
└── migrations/          # NEW: Migration for CLOSED stage

lib/
├── stage-transitions.ts      # MODIFY: Add CLOSED stage, isClosedTransition(), isTerminalStage()
├── github/
│   ├── delete-branch-and-prs.ts  # REFERENCE: Existing PR close logic (reuse patterns)
│   └── close-prs-only.ts         # NEW: Close PRs without deleting branch
└── db/
    └── tickets.ts               # MODIFY: Add closeTicket() function

app/
├── api/
│   └── projects/[projectId]/tickets/
│       ├── [id]/
│       │   ├── transition/route.ts  # MODIFY: Handle VERIFY → CLOSED transition
│       │   └── close/route.ts       # NEW: Dedicated close endpoint (optional)
│       └── search/route.ts          # MODIFY: Include CLOSED tickets with muted styling
└── lib/
    └── hooks/
        └── mutations/
            └── useCloseTicket.ts    # NEW: Close mutation hook

components/
├── board/
│   ├── board.tsx                    # MODIFY: Handle Close zone drop + confirmation modal
│   ├── stage-column.tsx             # MODIFY: Split SHIP column for dual drop zones
│   ├── close-confirmation-modal.tsx # NEW: Close confirmation dialog
│   └── close-zone.tsx               # NEW: Close drop zone component
└── tickets/
    └── ticket-search-result.tsx     # MODIFY: Muted styling + "Closed" badge

tests/
├── unit/
│   └── stage-validation.test.ts     # MODIFY: Add CLOSED transition tests
├── integration/
│   └── tickets/
│       ├── transitions.test.ts      # MODIFY: Add VERIFY → CLOSED tests
│       └── close.test.ts            # NEW: Close-specific integration tests
└── e2e/
    └── board/
        └── close-ticket.spec.ts     # NEW: Dual drop zone E2E tests
```

**Structure Decision**: Next.js App Router web application structure. Extends existing transition system with CLOSED state. Leverages existing `delete-branch-and-prs.ts` pattern for PR closure (without branch deletion).

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No complexity violations identified. This feature:
- Extends existing enum (no new data models beyond `closedAt` field)
- Reuses existing PR closure patterns from `delete-branch-and-prs.ts`
- Follows established modal confirmation patterns (QuickImplModal, RollbackVerifyModal)
- Uses existing search infrastructure with minimal modifications
