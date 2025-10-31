# Implementation Plan: Jira-Style Ticket Numbering System

**Branch**: `077-935-jira-style` | **Date**: 2025-10-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/077-935-jira-style/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a Jira-style ticket numbering system where each project has a unique 3-character key (e.g., "ABC", "MOB") and tickets are numbered sequentially per project (e.g., ABC-1, ABC-2, MOB-1). This replaces the current global ticket ID system with project-scoped identifiers for better UX. The system will use PostgreSQL sequences for thread-safe number generation, denormalized ticket keys for performance, and provide clean URLs like `/browse/ABC-123`. Existing tickets will be migrated to the new system while preserving internal IDs for backward compatibility.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.17, PostgreSQL 14+, Zod 4.x
**Storage**: PostgreSQL database via Prisma ORM
**Testing**: Vitest (unit tests), Playwright (E2E/integration tests)
**Target Platform**: Vercel serverless (Next.js optimized)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: <50ms p95 ticket lookup by key, <100ms p95 ticket creation, zero race conditions in number generation
**Constraints**: Thread-safe sequence generation, backward compatibility with existing ticket IDs, no breaking changes to foreign key relationships
**Scale/Scope**: Multi-tenant (users → projects → tickets), existing production data requires migration, test suite must be updated (fix only, no new tests per user request)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development ✅
- **Status**: PASS
- **Compliance**: All code will use TypeScript strict mode, explicit types for database schema changes, Zod schemas for API validation
- **Notes**: Prisma schema updates will generate TypeScript types automatically

### Principle II: Component-Driven Architecture ✅
- **Status**: PASS
- **Compliance**: UI updates will use existing shadcn/ui components, API routes follow Next.js conventions
- **Notes**: Limited UI changes (ticket display components), primary work is backend schema and API

### Principle III: Test-Driven Development ⚠️
- **Status**: CONDITIONAL PASS (user override)
- **Compliance**: User explicitly requested "DO NOT ADD NEW TESTS! YOU SHOULD ONLY FIX THE OLD ONE FOR NOW"
- **Notes**: Will update existing tests to work with new ticket numbering system, no new test coverage required per user directive
- **Risk**: Test coverage gaps for new functionality (migration, key generation, lookup endpoints)
- **Mitigation**: Document test gaps in plan for future backlog items

### Principle IV: Security-First Design ✅
- **Status**: PASS
- **Compliance**: Input validation via Zod (ticket key format), Prisma parameterized queries, no exposure of internal IDs in new URLs
- **Notes**: User authorization checks remain unchanged (userId validation on project access)

### Principle V: Database Integrity ✅
- **Status**: PASS
- **Compliance**: All schema changes via Prisma migrations, unique constraints on ticket keys and (projectId, ticketNumber), PostgreSQL sequence function for thread-safety
- **Notes**: Migration will use transactions to ensure consistency

### Specification Clarification Guardrails ✅
- **Status**: PASS
- **Compliance**: PRAGMATIC policy applied per user request, Auto-Resolved Decisions documented in spec.md
- **Notes**: Security controls and data integrity requirements preserved despite PRAGMATIC mode

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
prisma/
├── schema.prisma                           # Schema changes: Project.key, Ticket.ticketNumber, Ticket.ticketKey
└── migrations/
    └── YYYYMMDDHHMMSS_jira_style_numbering/
        └── migration.sql                    # Migration script with sequence function

app/
├── api/
│   ├── browse/[key]/route.ts               # NEW: Ticket lookup by key endpoint
│   └── projects/[projectId]/
│       ├── route.ts                        # UPDATE: Add project key to response
│       └── tickets/
│           ├── route.ts                    # UPDATE: Generate ticketNumber and ticketKey
│           └── [id]/
│               └── route.ts                # UPDATE: Support ticket key in path param
├── lib/
│   ├── db/
│   │   └── ticket-sequence.ts              # NEW: Helper for ticket number generation
│   └── schemas/
│       ├── project.ts                      # UPDATE: Add key field validation
│       └── ticket.ts                       # UPDATE: Add ticketKey and ticketNumber schemas
└── browse/[key]/
    └── page.tsx                            # NEW: Ticket detail page via key URL

components/
└── board/
    ├── ticket-card.tsx                     # UPDATE: Display ticketKey instead of ID
    └── ticket-detail.tsx                   # UPDATE: Display ticketKey in header

tests/
├── unit/
│   └── ticket-key-generation.test.ts       # UPDATE: Fix tests for key generation
├── integration/
│   └── ticket-lookup.spec.ts               # UPDATE: Fix tests for key-based lookup
└── e2e/
    └── ticket-creation.spec.ts             # UPDATE: Fix tests expecting ticketKey
```

**Structure Decision**: This is a Next.js 15 App Router application with full-stack architecture. Database changes via Prisma migrations, API routes for backend logic, and React components for frontend. The feature primarily touches:
1. **Database layer**: Schema changes and migration (Project.key, Ticket fields, sequence function)
2. **API layer**: New `/browse/:key` endpoint, updated ticket CRUD operations
3. **UI layer**: Ticket display components updated to show keys instead of IDs
4. **Test layer**: Existing tests updated to accommodate new numbering system

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Test-Driven Development (Principle III) | User explicitly requested "DO NOT ADD NEW TESTS! YOU SHOULD ONLY FIX THE OLD ONE FOR NOW" | User wants rapid delivery, test coverage gaps will be addressed in future backlog items per spec.md |

**Justification**: This is a user-approved trade-off prioritizing delivery speed over comprehensive test coverage. The feature involves schema changes and migration that would normally require extensive new test coverage (migration validation, sequence function thread-safety, key generation uniqueness, lookup performance). User has accepted the risk of test gaps for faster initial delivery.

---

## Phase 0: Research (COMPLETED)

**Status**: ✅ Complete
**Duration**: ~1 hour
**Output**: `research.md`

### Research Summary

All technical unknowns have been resolved through research:

1. **PostgreSQL Sequence Function**: Thread-safe number generation using custom function with per-project sequences
2. **Project Key Generation**: Derive from project name with collision handling
3. **Migration Strategy**: Single transaction with data population and constraint addition
4. **Denormalized Keys**: Store ticket keys for performance (<50ms p95 target)
5. **API Backward Compatibility**: Support both numeric IDs and ticket keys in path parameters

**Key Decisions**:
- Use PostgreSQL sequences (atomic operations) for thread-safety
- Store `ticketKey` as denormalized field with unique index
- Make project keys immutable after creation
- Support both old (numeric ID) and new (ticket key) API patterns

**Risk Mitigation**:
- Full transaction for migration (atomic)
- Database backup before production migration
- Staging environment testing required
- Downtime planned for migration window

---

## Phase 1: Design & Contracts (COMPLETED)

**Status**: ✅ Complete
**Duration**: ~2 hours
**Outputs**: `data-model.md`, `contracts/api-contracts.md`, `quickstart.md`

### Design Summary

**Schema Changes**:
- `Project.key`: VARCHAR(3), unique, not null, indexed
- `Ticket.ticketNumber`: INT, not null, unique per project
- `Ticket.ticketKey`: VARCHAR(20), unique, not null, indexed

**New Endpoints**:
- `GET /browse/:key` - Primary user-facing ticket lookup

**Updated Endpoints**:
- `POST /api/projects/:projectId/tickets` - Auto-generate ticket number and key
- `GET /api/projects/:projectId/tickets/:id` - Support both numeric ID and ticket key
- `POST /api/projects` - Add optional `key` field with auto-generation

**Database Functions**:
- `get_next_ticket_number(project_id)` - Thread-safe sequence generation

**Validation Schemas**:
- Project key: 3 uppercase alphanumeric characters
- Ticket key: Format `{KEY}-{NUM}` (e.g., "ABC-123")

**Performance Targets**:
- Ticket lookup by key: <50ms p95
- Ticket creation: <100ms p95
- Zero race conditions (enforced by PostgreSQL sequences)

### Constitution Re-Check (Post-Design)

All principles remain compliant:
- ✅ TypeScript-First Development: Prisma generates TypeScript types, Zod schemas for validation
- ✅ Component-Driven Architecture: Minimal UI changes using shadcn/ui components
- ⚠️ Test-Driven Development: User override in effect (fix existing tests only)
- ✅ Security-First Design: Input validation via Zod, Prisma parameterized queries
- ✅ Database Integrity: Migrations with transactions, unique constraints, indexes

**No new violations introduced during design phase.**

---

## Phase 2: Task Generation (PENDING)

**Status**: ⏸️ Pending
**Command**: `/speckit.tasks`
**Note**: Task generation is performed by a separate command (`/speckit.tasks`), not by `/speckit.plan`.

The task generation phase will break down the implementation into granular, ordered tasks based on the design artifacts produced in Phase 1.

**Expected Task Categories**:
1. Database migration (schema, function, data population)
2. API layer (new endpoints, updated endpoints, helpers)
3. Frontend updates (components, pages, links)
4. Test updates (fix existing tests for new fields)
5. Documentation updates (if needed)

---

## Implementation Readiness

**Ready to Proceed**: ✅ YES

All prerequisites for implementation are complete:
- [x] Technical context defined
- [x] Constitution check passed (with justified exception)
- [x] Research completed (all unknowns resolved)
- [x] Data model designed
- [x] API contracts defined
- [x] Quickstart guide created
- [x] Agent context updated (CLAUDE.md)

**Next Steps**:
1. Run `/speckit.tasks` to generate implementation task list
2. Review tasks with stakeholders
3. Execute implementation following `quickstart.md`
4. Test on staging environment
5. Deploy to production with scheduled downtime
