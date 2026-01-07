# Implementation Plan: Fix Display Closed Ticket Modal

**Branch**: `AIB-156-fix-display-closed` | **Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-156-fix-display-closed/spec.md`

## Summary

Fix the issue where clicking on a closed ticket from search results fails to display the ticket modal. The root cause is that when the board opens a ticket via URL parameters (`?ticket=ABC-123&modal=open`), it searches for the ticket in `allTickets` which only contains tickets visible on the board columns. Since CLOSED tickets are filtered out from the board display, they cannot be found and the modal doesn't open. The solution is to fetch the ticket from the backend when it's not present in the kanban state.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5.90.5, Prisma 6.x, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E for browser-required features)
**Target Platform**: Web application (Linux server, modern browsers)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Modal opens in <2 seconds on standard network conditions (per SC-002)
**Constraints**: Must integrate with existing TanStack Query caching, must not regress existing modal functionality
**Scale/Scope**: Single project, ~50 components, fix affects board and modal components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|-----------|------------|-------|
| **I. TypeScript-First** | ✅ PASS | All code in TypeScript strict mode, explicit types required |
| **II. Component-Driven** | ✅ PASS | Using existing shadcn/ui components, no new primitives needed |
| **III. Test-Driven (NON-NEGOTIABLE)** | ✅ PASS | Integration tests for API, RTL component tests for UI interaction |
| **IV. Security-First** | ✅ PASS | Uses existing authorization helpers, no new attack vectors |
| **V. Database Integrity** | ✅ PASS | Read-only fetch, no schema changes needed |
| **VI. AI-First Development** | ✅ PASS | No tutorials or human documentation, spec in specs/ folder |

**All gates passed.** Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-156-fix-display-closed/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
app/
├── api/projects/[projectId]/tickets/
│   ├── route.ts                    # GET all tickets (existing)
│   └── [id]/route.ts               # GET single ticket - ALREADY supports ticket key lookup
├── lib/hooks/queries/
│   └── useTickets.ts               # MODIFY: Add useTicketByKey hook
├── lib/query-keys.ts               # MODIFY: Add ticketByKey query key
└── projects/[projectId]/board/page.tsx  # Board page (existing)

components/
├── board/
│   ├── board.tsx                   # MODIFY: Add fallback fetch logic for closed tickets
│   └── ticket-detail-modal.tsx     # Existing (already handles closed tickets read-only)
└── search/
    ├── ticket-search.tsx           # Existing (already sets URL params)
    └── search-results.tsx          # Existing (already shows closed badge)

tests/
├── integration/tickets/
│   └── ticket-by-key.test.ts       # NEW: Integration tests for ticket-by-key lookup
└── unit/components/
    └── board-modal-open.test.tsx   # NEW: RTL tests for modal opening behavior
```

**Structure Decision**: Web application structure following existing Next.js App Router conventions. No new API endpoint needed - existing `/api/projects/{projectId}/tickets/{identifier}` already supports ticket key lookup (discovered during research).

## Complexity Tracking

*No constitution violations. All changes follow existing patterns.*

| Item | Justification |
|------|---------------|
| New query hook | Integrates with existing TanStack Query setup; reuses existing API endpoint |
| New state variable | Required to track pending ticket key for async fetch flow |

## Constitution Check (Post-Design)

*Re-check after Phase 1 design artifacts are complete.*

| Principle | Compliance | Verification |
|-----------|------------|--------------|
| **I. TypeScript-First** | ✅ PASS | All new code has explicit types; `useTicketByKey` returns `TicketWithVersion \| null` |
| **II. Component-Driven** | ✅ PASS | No new UI components; reuses existing modal |
| **III. Test-Driven** | ✅ PASS | Integration tests for API (existing endpoint), RTL tests for modal behavior |
| **IV. Security-First** | ✅ PASS | Uses `verifyProjectAccess()` authorization; no new inputs |
| **V. Database Integrity** | ✅ PASS | Read-only operation; no schema changes |
| **VI. AI-First** | ✅ PASS | All documentation in specs/ folder |

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Implementation Plan | `specs/AIB-156-fix-display-closed/plan.md` | ✅ Complete |
| Research | `specs/AIB-156-fix-display-closed/research.md` | ✅ Complete |
| Data Model | `specs/AIB-156-fix-display-closed/data-model.md` | ✅ Complete |
| API Contracts | `specs/AIB-156-fix-display-closed/contracts/api.md` | ✅ Complete |
| Quickstart | `specs/AIB-156-fix-display-closed/quickstart.md` | ✅ Complete |
| Tasks | `specs/AIB-156-fix-display-closed/tasks.md` | ⏳ Pending (Phase 2) |

## Implementation Approach Summary

1. **No new API endpoint needed** - Existing `/api/projects/{projectId}/tickets/{identifier}` supports both numeric ID and ticket key lookup (lines 73-91 of route.ts)

2. **Add `useTicketByKey` hook** - New TanStack Query hook to fetch tickets by key with proper caching

3. **Modify board URL parameter handling** - Add fallback fetch when ticket not found in `allTickets`

4. **Update `selectedTicket` derivation** - Include fetched ticket as fallback for closed tickets

5. **Testing per Constitution III**:
   - Integration tests for existing API endpoint with ticket key
   - RTL component tests for modal opening with closed ticket
