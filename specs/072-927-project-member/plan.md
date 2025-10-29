# Implementation Plan: Project Member Authorization

**Branch**: `072-927-project-member` | **Date**: 2025-10-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/072-927-project-member/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable project members (ProjectMember table) to access project boards and APIs alongside project owners. Update all 22 project-scoped API endpoints from owner-only authorization to "owner OR member" authorization. Maintain backward compatibility with existing authentication flow while adding membership validation through Prisma joins. Owner-exclusive actions (project deletion, member management) remain protected.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.17, NextAuth 5.0-beta, TanStack Query 5.90
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest 4.0 (unit tests), Playwright 1.48 (E2E/API tests)
**Target Platform**: Vercel (Next.js serverless functions), Node.js 22.20 LTS
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Authorization queries <100ms p95 (database join performance critical)
**Constraints**: Session-based auth only (NextAuth), backward compatibility with existing API clients, no breaking changes to auth flow
**Scale/Scope**: 22 API endpoints affected, existing ProjectMember schema (no migration needed), test coverage for owner + member paths

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Required Gates (from Constitution)

✅ **TypeScript-First Development (Principle I)**: No violations
- All code in TypeScript strict mode (tsconfig.json: `strict: true`)
- Authorization helpers explicitly typed
- No `any` types needed for this feature
- Prisma types auto-generated for ProjectMember joins

✅ **Component-Driven Architecture (Principle II)**: No violations
- Server-side authorization logic only (API routes)
- No UI component changes required for core authorization
- Follows Next.js App Router conventions

✅ **Test-Driven Development (Principle III)**: Requirements met
- Existing E2E tests: `tests/e2e/*.spec.ts` (to be extended for member scenarios)
- Existing API tests: `tests/api/*.spec.ts` (to be extended)
- Unit tests: `tests/unit/` (new unit tests for authorization helpers using Vitest)
- Test discovery workflow: Search existing test files first, extend before creating new
- Hybrid testing: Vitest for pure auth logic functions, Playwright for API contract tests

✅ **Security-First Design (Principle IV)**: Enhanced by this feature
- Authorization strengthened with membership validation
- Prisma parameterized queries (no raw SQL)
- Session validation via NextAuth (existing pattern)
- Input validation via Zod schemas (existing pattern)

✅ **Database Integrity (Principle V)**: No migration needed
- ProjectMember schema already exists
- Foreign keys: projectId → Project.id, userId → User.id
- Indexes already present: `@@index([projectId])`, `@@index([userId])`
- Unique constraint: `@@unique([projectId, userId])`

### Specification Clarification Guardrails (Constitution Principle V)

**Policy Applied**: AUTO → CONSERVATIVE (fallback triggered, documented in spec.md)
**Decisions Made**:
1. Simple "owner OR member" access vs full RBAC (deferred granular permissions)
2. Read-write access for all members (no read-only role distinction)
3. Owner retains exclusive project-level admin rights
4. Comprehensive testing for 22 endpoints

**Trade-offs Accepted**:
- Scope: Defer role-based permissions (ProjectMember.role exists but unused)
- Timeline: Simpler implementation path (OR logic vs action-based permissions)
- Security: Conservative approach - all members trusted collaborators

### Constitution Violations

**NONE**: This feature aligns with all constitution principles.

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
│           ├── route.ts                    # ← UPDATE: Add member auth
│           ├── members/route.ts            # ← OWNER-ONLY: Add/remove members
│           ├── jobs/status/route.ts        # ← UPDATE: Add member auth
│           └── tickets/
│               ├── route.ts                # ← UPDATE: Add member auth (list, create)
│               └── [id]/
│                   ├── route.ts            # ← UPDATE: Add member auth (get, update, delete)
│                   ├── branch/route.ts     # ← UPDATE: Add member auth
│                   ├── transition/route.ts # ← UPDATE: Add member auth
│                   ├── comments/
│                   │   ├── route.ts        # ← UPDATE: Add member auth
│                   │   ├── ai-board/route.ts # ← UPDATE: Add member auth
│                   │   └── [commentId]/route.ts # ← UPDATE: Add member auth
│                   ├── images/
│                   │   ├── route.ts        # ← UPDATE: Add member auth
│                   │   └── [attachmentIndex]/route.ts # ← UPDATE: Add member auth
│                   └── timeline/route.ts   # ← UPDATE: Add member auth
└── projects/
    └── [projectId]/
        └── board/
            └── page.tsx                    # ← UPDATE: Add member auth (SSR)

lib/
├── db/
│   ├── auth-helpers.ts                     # ← UPDATE: New helpers (verifyProjectAccess, verifyTicketAccess)
│   └── users.ts                            # ← NO CHANGE (requireAuth remains unchanged)
└── query-keys.ts                           # ← NO CHANGE (TanStack Query keys)

prisma/
└── schema.prisma                           # ← NO CHANGE (ProjectMember schema exists)

tests/
├── unit/
│   └── auth-helpers.test.ts               # ← NEW: Vitest unit tests for auth logic
├── api/
│   └── project-member-auth.spec.ts        # ← NEW: Playwright API contract tests
└── e2e/
    ├── board-member-access.spec.ts        # ← NEW: E2E test for member board access
    └── ticket-crud-member.spec.ts         # ← EXTEND: Add member scenarios to existing ticket tests
```

**Structure Decision**: Next.js full-stack web application. Authorization logic lives in `/lib/db/auth-helpers.ts` (shared helper functions). All 22 API route handlers in `/app/api/projects/[projectId]/**` consume these helpers. Board page SSR at `/app/projects/[projectId]/board/page.tsx` uses same authorization pattern.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No constitution violations**: This section is not applicable for this feature.

---

## Phase 0: Research (COMPLETED)

**Output**: `research.md`

**Summary**: All architectural decisions were resolved during specification (AUTO → CONSERVATIVE policy). Research document consolidates:
- Authorization pattern: "owner OR member" access
- Database query performance with Prisma joins
- Error handling: 403 for APIs, 404 for SSR pages
- Test strategy: Vitest (unit) + Playwright (API + E2E)
- Backward compatibility: No breaking changes

**Key Finding**: No additional dependencies required. Existing ProjectMember schema, indexes, and foreign keys support efficient membership queries.

---

## Phase 1: Design & Contracts (COMPLETED)

**Outputs**:
- `data-model.md` - Entity relationships and authorization patterns
- `contracts/api-authorization.md` - API contract specifications for 22 endpoints
- `quickstart.md` - Developer implementation guide
- `CLAUDE.md` - Updated with TypeScript, Next.js, Prisma context

**Summary**:

### Data Model
- **No schema changes**: ProjectMember exists with proper indexes
- **Authorization patterns**:
  - `verifyProjectAccess(projectId)` - Owner OR member
  - `verifyTicketAccess(ticketId)` - Owner OR member via project
  - `verifyProjectOwnership(projectId)` - Owner-only (unchanged)
- **Performance**: Single query with OR condition, indexed lookups <100ms p95

### API Contracts
- **22 endpoints affected**: 20 upgraded to owner OR member, 2 remain owner-only
- **Authorization matrix**: Owner ✅ / Member ✅ / Non-member ❌ for most endpoints
- **Member management**: Owner-only (cannot be performed by members)
- **Error codes**: 403 Forbidden (APIs), 404 Not Found (SSR pages)

### Implementation Guide
- **Step-by-step**: Update auth helpers → update endpoints → write tests
- **Test strategy**: Unit tests (Vitest), API tests (Playwright), E2E tests (Playwright)
- **Performance testing**: <100ms p95 benchmark, query plan verification
- **Deployment checklist**: Pre-deployment checks, smoke tests, monitoring

---

## Post-Design Constitution Check

*Re-evaluation after Phase 1 design complete*

### Constitution Compliance

✅ **TypeScript-First Development (Principle I)**: PASS
- Authorization helpers fully typed
- Prisma types auto-generated for ProjectMember joins
- No `any` types introduced

✅ **Component-Driven Architecture (Principle II)**: PASS
- Server-side authorization only (no UI component changes)
- Next.js App Router conventions followed
- API route patterns consistent with existing codebase

✅ **Test-Driven Development (Principle III)**: PASS
- Unit tests: `tests/unit/auth-helpers.test.ts` (Vitest)
- API tests: `tests/api/project-member-auth.spec.ts` (Playwright)
- E2E tests: `tests/e2e/board-member-access.spec.ts` (Playwright)
- Test discovery workflow: Extend existing tests first, create new only if needed
- Hybrid testing: Vitest for pure functions, Playwright for integration

✅ **Security-First Design (Principle IV)**: PASS
- All 22 endpoints protected with authorization checks
- Prisma parameterized queries (no SQL injection risk)
- Session validation via NextAuth (existing pattern)
- Test coverage includes negative cases (non-member rejection)

✅ **Database Integrity (Principle V)**: PASS
- No migration needed (schema exists)
- Foreign keys enforce referential integrity
- Indexes support efficient queries
- Unique constraint prevents duplicate memberships

### Specification Clarification Guardrails

✅ **AUTO → CONSERVATIVE fallback**: Applied correctly in spec.md
- Decision 1: Simple "owner OR member" vs RBAC (deferred granular permissions)
- Decision 2: Read-write member access (no read-only role)
- Decision 3: Owner retains exclusive project admin rights
- Decision 4: Comprehensive testing for all 22 endpoints

✅ **Trade-offs documented**: Spec clearly documents scope, timeline, security trade-offs

### Final Verdict

**NO CONSTITUTION VIOLATIONS**: Design fully complies with all constitution principles.

**Quality Gates**:
- ✅ Type safety: All authorization functions explicitly typed
- ✅ Security: Authorization enforced at all entry points
- ✅ Performance: Indexed queries, <100ms target
- ✅ Testing: Hybrid strategy covers unit, API, and E2E scenarios
- ✅ Backward compatibility: Existing owner access unchanged

**Ready for Phase 2 (Tasks)**: Design is complete and constitution-compliant.
