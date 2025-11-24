# Implementation Plan: Mention Notifications

**Branch**: `AIB-77-mention-notifications` | **Date**: 2025-11-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/077-mention-notifications/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement @mention notifications for ticket comments to reduce collaboration friction. When users mention team members using @username syntax in comments, the mentioned users receive notifications visible via a header bell icon. Notifications are delivered via polling (15s intervals) and include actor info, comment preview, and direct navigation to the source comment. Users can mark notifications as read individually or in bulk.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.17, TanStack Query v5.90.5, shadcn/ui, lucide-react, date-fns 4.1.0
**Storage**: PostgreSQL 14+ via Prisma ORM, existing Comment and User models
**Testing**: Vitest (unit tests for utilities), Playwright (integration/E2E tests)
**Target Platform**: Web application (Next.js SSR + client-side React), hosted on Vercel
**Project Type**: Web (Next.js App Router structure)
**Performance Goals**: Notification dropdown load <500ms, polling every 15s, mark-all-read <2s for 10+ notifications
**Constraints**: Client-side polling (no WebSockets), 30-day notification retention, optimistic UI updates required
**Scale/Scope**: Multi-tenant (project-based), ~50-500 users per project, notification volume ~10-100/day per active user

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Principle I: TypeScript-First Development
- **Compliance**: Full TypeScript strict mode with explicit types
- **Approach**: All new entities (Notification model, API responses, mention parsing utilities) will have complete TypeScript interfaces
- **No violations**: All types explicitly defined, no `any` types

### ✅ Principle II: Component-Driven Architecture
- **Compliance**: Using shadcn/ui components exclusively
- **Approach**:
  - Notification bell: shadcn Popover + Badge components
  - Dropdown content: shadcn ScrollArea + Button components
  - Avatar display: existing shadcn Avatar component
- **Server/Client split**: API routes in `/app/api/notifications/`, client components in `/components/notifications/`
- **No violations**: No custom UI primitives, follows Next.js App Router conventions

### ✅ Principle III: Test-Driven Development
- **Compliance**: Hybrid testing strategy
- **Unit tests (Vitest)**:
  - Mention parsing regex utilities (`lib/mention-parser.ts`)
  - Relative timestamp formatting (`lib/date-utils.ts`)
  - Notification filtering logic
- **Integration tests (Playwright)**:
  - Comment creation → notification generation flow
  - Notification bell UI interactions
  - Mark as read functionality
  - Navigation to comment location
- **No violations**: Tests written before implementation, existing test patterns followed

### ✅ Principle IV: Security-First Design
- **Compliance**: Input validation and secure queries
- **Approach**:
  - Zod schema validation for notification API inputs
  - Prisma parameterized queries for all database operations
  - Authorization checks: only project members see notifications
  - No sensitive data exposure (comment content truncated to 80 chars in dropdown)
- **No violations**: All user inputs validated, no raw SQL

### ✅ Principle V: Database Integrity
- **Compliance**: Prisma migrations for schema changes
- **Approach**:
  - New `Notification` model added via `prisma migrate dev`
  - Foreign key constraints (userId, commentId, ticketId, actorId)
  - Soft deletes via `deletedAt` field for audit trail
  - Transaction for bulk "mark all as read" operations
- **No violations**: Schema-level constraints enforced, migrations only

### ✅ Principle VI: Specification Clarification Guardrails
- **Compliance**: AUTO policy with PRAGMATIC fallback applied
- **Approach**: 5 auto-resolved decisions documented in spec (mention parsing, retention, polling vs real-time, full page priority, comment visibility)
- **Trade-offs documented**: Each decision includes rationale and reviewer notes
- **No violations**: All decisions traceable, baseline safeguards retained

### 🔶 Constitution Compliance Summary
**Status**: ✅ PASS - No violations detected
**Complexity additions**: None (feature fits within existing architecture patterns)
**Risk level**: Low - extends existing comment system with standard notification patterns

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
│   └── notifications/
│       ├── route.ts                    # GET (list), POST (create)
│       ├── [id]/
│       │   └── mark-read/
│       │       └── route.ts            # PATCH (mark single as read)
│       └── mark-all-read/
│           └── route.ts                # POST (mark all as read)
│
├── (dashboard)/
│   └── layout.tsx                      # Add NotificationBell to header
│
components/
├── notifications/
│   ├── notification-bell.tsx           # Bell icon + badge (client component)
│   ├── notification-dropdown.tsx       # Popover content (client component)
│   ├── notification-item.tsx           # Single notification display
│   └── use-notifications.ts            # TanStack Query hook for polling
│
lib/
├── mention-parser.ts                   # Extract @mentions from text (unit testable)
├── date-utils.ts                       # Relative timestamp formatting (unit testable)
└── db/
    └── notifications.ts                # Notification database queries
│
prisma/
├── schema.prisma                       # Add Notification model
└── migrations/
    └── [timestamp]_add_notifications/
        └── migration.sql
│
tests/
├── unit/
│   ├── mention-parser.test.ts         # Vitest: regex parsing tests
│   └── date-utils.test.ts             # Vitest: timestamp formatting tests
│
└── e2e/
    └── notifications.spec.ts           # Playwright: full notification flow
```

**Structure Decision**: Next.js App Router web application structure. API routes handle server-side logic (notification CRUD, @mention detection on comment creation). Client components manage UI polling and optimistic updates. Pure utility functions (mention parsing, date formatting) isolated for Vitest unit testing. Integration flows (comment → notification → navigation) covered by Playwright E2E tests.

## Complexity Tracking

*Not applicable - no constitution violations detected. All implementation follows existing architecture patterns.*
