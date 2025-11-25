# Implementation Plan: AI-Board Comment Mention Notifications

**Branch**: `AIB-79-notification-not-show` | **Date**: 2025-11-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-79-notification-not-show/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Fix missing notifications when AI-board mentions users in comments. The AI-board assistant currently posts comments via `/api/projects/{projectId}/tickets/{id}/comments/ai-board` but does not create notifications for mentioned users. This implementation will extract mentions from AI-board comments, validate project membership, and create notifications using the existing notification system patterns (reusing mention parser, validation logic, and non-blocking error handling from regular comments endpoint).

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, TanStack Query v5.90.5
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit tests), Playwright (integration/E2E tests)
**Target Platform**: Web application (Next.js server + client)
**Project Type**: Web (Next.js App Router with API routes)
**Performance Goals**: Notification creation within 500ms of comment creation, notifications visible within 15s polling interval
**Constraints**: Non-blocking notification creation (comment creation must succeed even if notification fails), maintain existing 15-second notification polling interval
**Scale/Scope**: Single endpoint modification (`/api/projects/[projectId]/tickets/[id]/comments/ai-board`), reuse existing utilities (mention parser, notification system, AI-board user lookup)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development
- ✅ **PASS**: All modifications to `/api/projects/[projectId]/tickets/[id]/comments/ai-board` will use TypeScript strict mode
- ✅ **PASS**: Existing utilities (`extractMentionUserIds`, `getAIBoardUserId`) have explicit type signatures
- ✅ **PASS**: Notification creation will use typed Prisma client (no `any` types)

### Principle II: Component-Driven Architecture
- ✅ **PASS**: Server-side API route modification only (no UI components changed)
- ✅ **PASS**: Follows Next.js App Router conventions (`/app/api` structure)
- ✅ **PASS**: Reuses existing utilities in `/lib/` (mention parser, AI-board user lookup)

### Principle III: Test-Driven Development
- ✅ **PASS**: Existing test file `tests/e2e/notifications.spec.ts` will be extended (not creating duplicate)
- ✅ **PASS**: Playwright tests for API integration and notification behavior (appropriate tool choice)
- ✅ **PASS**: Tests will verify all acceptance scenarios from spec (AI-board mentions trigger notifications)
- **Action Required**: Search for existing notification tests before adding new ones

### Principle IV: Security-First Design
- ✅ **PASS**: Reuses existing project membership validation (owner + member checks)
- ✅ **PASS**: Uses Prisma parameterized queries for notification creation (no raw SQL)
- ✅ **PASS**: Validates mentioned users are project members before creating notifications
- ✅ **PASS**: Workflow token authentication already enforces endpoint security

### Principle V: Database Integrity
- ✅ **PASS**: Uses existing `Notification` schema (no migration required)
- ✅ **PASS**: Notification creation uses Prisma client (type-safe operations)
- ✅ **PASS**: Follows soft delete pattern (existing `deletedAt` field in schema)
- ✅ **PASS**: Foreign key constraints already exist (recipientId, actorId, commentId, ticketId)

### Principle VI: Specification Clarification Guardrails
- ✅ **PASS**: Spec includes `Auto-Resolved Decisions` section documenting AUTO policy application
- ✅ **PASS**: Trade-offs documented (non-blocking notification creation, scope limited to user mentions)
- ✅ **PASS**: Security and data integrity preserved (project membership validation, existing patterns reused)

**Gate Status**: ✅ ALL GATES PASSED - Proceed to Phase 0 research

## Project Structure

### Documentation (this feature)

```
specs/AIB-79-notification-not-show/
├── spec.md              # Feature specification (already exists)
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
│           └── tickets/
│               └── [id]/
│                   └── comments/
│                       └── ai-board/
│                           └── route.ts          # PRIMARY MODIFICATION TARGET
├── lib/
│   ├── db/
│   │   ├── ai-board-user.ts                      # Existing: getAIBoardUserId()
│   │   └── notifications.ts                      # Existing: notification utilities
│   └── utils/
│       └── mention-parser.ts                     # Existing: extractMentionUserIds()
└── components/
    └── notifications/                             # Existing notification UI (no changes)

tests/
├── e2e/
│   └── notifications.spec.ts                     # EXTEND: Add AI-board mention tests
└── unit/
    └── mention-parser.test.ts                    # Existing unit tests (reference only)

prisma/
└── schema.prisma                                 # Existing Notification model (no changes)
```

**Structure Decision**: Next.js App Router web application structure. This feature modifies a single API route (`/app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts`) to add notification creation logic. All supporting utilities already exist and will be imported from their existing locations. Testing will extend the existing `tests/e2e/notifications.spec.ts` file per constitution guidelines (no duplicate test files).

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations detected** - all constitution gates passed. This implementation follows existing patterns and reuses established utilities.

---

## Post-Design Constitution Re-Evaluation

*Re-check after Phase 1 design completion*

### Principle I: TypeScript-First Development
- ✅ **CONFIRMED**: All design artifacts use TypeScript strict mode
- ✅ **CONFIRMED**: API contract specifies typed request/response schemas
- ✅ **CONFIRMED**: Data model documents explicit types for all fields
- ✅ **CONFIRMED**: No `any` types planned in implementation (uses existing typed utilities)

### Principle II: Component-Driven Architecture
- ✅ **CONFIRMED**: Single API route modification (Next.js App Router pattern)
- ✅ **CONFIRMED**: Reuses utilities from `/lib/` (DRY principle maintained)
- ✅ **CONFIRMED**: No UI component changes (server-side only)
- ✅ **CONFIRMED**: Feature-based documentation in `specs/AIB-79-*/` folder

### Principle III: Test-Driven Development
- ✅ **CONFIRMED**: Quickstart specifies extending existing test file (no duplicates)
- ✅ **CONFIRMED**: Playwright chosen for API integration tests (correct tool selection)
- ✅ **CONFIRMED**: Test coverage maps to all acceptance scenarios from spec
- ✅ **CONFIRMED**: Test-first approach documented in quickstart (write tests before implementation)

### Principle IV: Security-First Design
- ✅ **CONFIRMED**: Project membership validation documented in data model
- ✅ **CONFIRMED**: Prisma parameterized queries (no raw SQL in design)
- ✅ **CONFIRMED**: Foreign key constraints enforced at schema level
- ✅ **CONFIRMED**: Non-blocking error handling prevents security failures from blocking operations

### Principle V: Database Integrity
- ✅ **CONFIRMED**: Zero migrations required (existing schema sufficient)
- ✅ **CONFIRMED**: Data model documents all foreign key relationships
- ✅ **CONFIRMED**: Soft delete pattern preserved (existing `deletedAt` field)
- ✅ **CONFIRMED**: Batch insert using `createMany` (atomic operation)

### Principle VI: Specification Clarification Guardrails
- ✅ **CONFIRMED**: Spec documents AUTO policy application with confidence scores
- ✅ **CONFIRMED**: Trade-offs explicitly documented in spec (non-blocking, scope limited to user mentions)
- ✅ **CONFIRMED**: Security and data integrity preserved in all auto-resolved decisions
- ✅ **CONFIRMED**: Research phase resolved all NEEDS CLARIFICATION items

**Final Gate Status**: ✅ ALL GATES REMAIN PASSED POST-DESIGN

**Design Integrity**: Implementation plan maintains all constitution principles. No compromises or technical debt introduced.

---

## Implementation Readiness Checklist

- ✅ Technical Context filled (all NEEDS CLARIFICATION resolved)
- ✅ Constitution Check passed (initial evaluation)
- ✅ Phase 0 complete: `research.md` generated (5 unknowns resolved)
- ✅ Phase 1 complete: `data-model.md` generated (existing entities documented)
- ✅ Phase 1 complete: API contract generated (`contracts/ai-board-comments-api.yaml`)
- ✅ Phase 1 complete: `quickstart.md` generated (step-by-step implementation guide)
- ✅ Phase 1 complete: Agent context updated (Claude context file)
- ✅ Constitution Check re-evaluated post-design (all gates passed)

**Status**: ✅ READY FOR PHASE 2 (Task Generation via `/speckit.tasks`)

---

## Summary

**Branch**: `AIB-79-notification-not-show`
**Planning Complete**: 2025-11-24

**Artifacts Generated**:
1. `plan.md` - This file (implementation plan)
2. `research.md` - Technical unknowns resolved (5 decisions documented)
3. `data-model.md` - Entity documentation (existing schema, no migrations)
4. `contracts/ai-board-comments-api.yaml` - OpenAPI 3.0 specification
5. `quickstart.md` - 30-minute implementation guide

**Key Design Decisions**:
- Replicate notification pattern from regular comments endpoint (lines 252-290)
- Non-blocking error handling (try-catch wrapper)
- Project membership validation before notification creation
- Self-mention exclusion (AI-board doesn't notify itself)
- Batch notification insert using `createMany()`

**Implementation Scope**:
- **Modified Files**: 1 (`app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts`)
- **Modified Tests**: 1 (`tests/e2e/notifications.spec.ts` - extend existing)
- **New Migrations**: 0 (existing schema sufficient)
- **New Dependencies**: 0 (all utilities already exist)

**Estimated Implementation Time**: ~30 minutes
**Risk Level**: Low (reuses proven patterns, minimal changes, comprehensive tests)

**Next Command**: `/speckit.tasks` (generates actionable tasks from this plan)
