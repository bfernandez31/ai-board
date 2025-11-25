# Implementation Plan: Notification Click Navigation to Ticket Conversation Tab

**Branch**: `AIB-80-show-ticket-conversation` | **Date**: 2025-11-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-80-show-ticket-conversation/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

When users click on a notification about a mention in a comment, they should be navigated directly to the ticket's conversation tab with the specific comment scrolled into view. The system must intelligently handle same-project navigation (same window) vs cross-project navigation (new tab), mark notifications as read before navigation, and ensure the conversation tab is automatically selected when the ticket modal opens.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 15 (App Router), React 18, TanStack Query v5.90.5, Prisma 6.x
**Storage**: PostgreSQL 14+ (Notification model with projectId, ticketId, ticketKey, commentId)
**Testing**: Vitest (unit tests for utilities), Playwright (integration and E2E tests)
**Target Platform**: Web browser (modern browsers, responsive design)
**Project Type**: Web application (Next.js App Router with API routes)
**Performance Goals**: <200ms navigation response, immediate visual feedback on notification click
**Constraints**: Must preserve browser tab context, handle cross-project navigation, race condition prevention on rapid clicks
**Scale/Scope**: Single feature enhancement affecting notification dropdown component and ticket modal state management

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### TypeScript-First Development ✅
- All code will be written in TypeScript strict mode with explicit type annotations
- No `any` types without justification
- Navigation context, notification state, and modal tab state will have proper interfaces

### Component-Driven Architecture ✅
- Using existing shadcn/ui components (Dialog, Tabs, Button)
- Modifying existing notification-dropdown.tsx (Client Component)
- Modifying existing ticket-detail-modal.tsx to support initialTab prop
- Feature-based folder structure maintained: components/notifications/, components/board/

### Test-Driven Development ✅
- Will search for existing tests first (notification and modal tests)
- Vitest for utility functions (URL building, project comparison logic)
- Playwright for E2E testing (notification click → modal navigation flow)
- Tests written before implementation (Red-Green-Refactor)

### Security-First Design ✅
- Input validation on notification data (Zod schemas)
- Prisma parameterized queries for notification reads/updates
- No sensitive data exposure (notification IDs are internal, projectId/ticketId validated)
- Authentication already handled by existing NextAuth.js middleware

### Database Integrity ✅
- Using existing Notification model (no schema changes required)
- Notification.read update will use Prisma transaction if needed
- Soft delete policy already in place (deletedAt field)
- No new migrations required

**STATUS**: All gates PASSED. No violations. Proceeding to Phase 0.

---

## Post-Design Constitution Re-Check

**Phase 1 Complete** - Re-evaluating all gates after design artifacts generated:

### TypeScript-First Development ✅
- All interfaces defined in `contracts/interfaces.ts` with explicit types
- No `any` types in contracts or utility functions
- Zod schemas for runtime validation (`lib/validations/notification.ts`)
- Type guards provided for runtime type checking

### Component-Driven Architecture ✅
- Minimal changes to existing components (notification-dropdown, ticket-detail-modal)
- New utility functions follow single-responsibility principle
- API endpoint follows Next.js App Router conventions
- Feature folder structure maintained

### Test-Driven Development ✅
- Unit tests planned for navigation-utils.ts (Vitest)
- E2E tests planned for full notification flow (Playwright)
- Test scenarios documented in quickstart.md
- TDD workflow: Red → Green → Refactor

### Security-First Design ✅
- API endpoint validates user ownership (recipientId check)
- Zod validation on all inputs
- Prisma parameterized queries (no raw SQL)
- No sensitive data in client-side code

### Database Integrity ✅
- No schema changes required (using existing Notification model)
- Update uses Prisma transactions if needed
- Read status update is idempotent (safe to retry)
- Soft delete policy respected (deletedAt check)

**FINAL STATUS**: All constitution gates remain PASSED after design phase. Implementation can proceed.

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
├── components/
│   └── notifications/
│       ├── notification-dropdown.tsx      # MODIFY: Add initialTab logic
│       ├── notification-bell.tsx           # READ: Understand context
│       └── use-notifications.ts            # MODIFY: Add mark-as-read mutation
├── lib/
│   └── hooks/
│       └── queries/
│           └── use-comments.ts             # READ: Comment query patterns
└── api/
    └── notifications/
        └── [id]/
            └── read/
                └── route.ts                # CREATE: Mark notification as read

components/
└── board/
    ├── ticket-detail-modal.tsx            # MODIFY: Accept initialTab prop
    ├── board.tsx                          # MODIFY: Pass initialTab from URL
    └── ...

lib/
├── utils/
│   └── navigation-utils.ts                # CREATE: Project comparison, URL building
└── validations/
    └── notification.ts                     # CREATE: Notification Zod schemas

tests/
├── unit/
│   └── navigation-utils.test.ts           # CREATE: Vitest tests
└── e2e/
    └── notification-navigation.spec.ts    # CREATE: Playwright tests
```

**Structure Decision**: Web application using Next.js App Router. Feature primarily touches notification components (`app/components/notifications/`) and ticket modal (`components/board/ticket-detail-modal.tsx`). New utility functions in `lib/utils/` for navigation logic. API route for mark-as-read endpoint. Hybrid testing with Vitest for pure functions and Playwright for user flows.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations detected. This section is intentionally empty.**
