# Implementation Plan: Automatic User Creation for GitHub OAuth

**Branch**: `054-901-automatic-user` | **Date**: 2025-10-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/054-901-automatic-user/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

When users sign in with GitHub OAuth in production, their User and Account records must be automatically created/updated in the database. This feature implements NextAuth.js callbacks to persist user data during authentication, enabling users to immediately create projects without foreign key constraint errors. The implementation uses database upserts for idempotency, handles concurrent authentication gracefully, and fails authentication if database operations fail (preventing orphaned sessions).

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: NextAuth.js (authentication), Prisma 6.x (ORM), Next.js 15 (App Router)
**Storage**: PostgreSQL 14+ via Prisma (User and Account models)
**Testing**: Vitest (unit tests for utility functions), Playwright (E2E authentication flows)
**Target Platform**: Vercel serverless (Node.js runtime)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: <500ms authentication callback execution, handle 50 concurrent sign-ins
**Constraints**: Vercel serverless function timeout (10 seconds), JWT strategy (not Prisma adapter), PostgreSQL connection pooling
**Scale/Scope**: Production deployment, supports concurrent user authentication, zero duplicate user records

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Core Principle Compliance

**I. TypeScript-First Development**: ✅ PASS
- All NextAuth callbacks will use explicit TypeScript types
- Prisma models already have generated TypeScript types
- No `any` types will be used (NextAuth types are well-defined)

**II. Component-Driven Architecture**: ✅ PASS
- Authentication is server-side only (NextAuth callbacks)
- No new UI components required (OAuth flow handled by NextAuth)
- API route structure follows Next.js conventions

**III. Test-Driven Development**: ✅ PASS
- E2E tests required for first-time and returning user authentication
- Unit tests required for concurrent authentication handling logic
- Test discovery: Search for existing authentication tests before creating new files
- Red-Green-Refactor cycle will be followed

**IV. Security-First Design**: ✅ PASS
- Email validation required (reject authentication if missing)
- Prisma parameterized queries (no raw SQL)
- No sensitive data exposed (tokens remain in Account model)
- Authentication failure on database errors (no orphaned sessions)

**V. Database Integrity**: ✅ PASS
- User/Account upsert operations ensure no duplicates
- Email uniqueness constraint enforced at schema level
- Prisma transaction for atomic User + Account creation
- No schema migration required (User and Account models exist)

**VI. Specification Clarification Guardrails**: ✅ PASS
- Auto-resolved decisions documented in spec.md
- PRAGMATIC mode chosen for upsert behavior (justified by internal system context)
- CONSERVATIVE mode chosen for error handling (authentication flow requires security-first)

### Gate Status: ✅ APPROVED
All non-negotiable rules satisfied. No constitution violations detected.

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
│   └── auth/
│       └── [...nextauth]/
│           └── route.ts         # NextAuth.js configuration (MODIFIED)
└── lib/
    ├── auth/
    │   ├── nextauth-config.ts   # NextAuth configuration with callbacks (NEW)
    │   └── user-service.ts      # User/Account upsert logic (NEW)
    └── db/
        └── prisma.ts            # Prisma client singleton (EXISTING)

prisma/
└── schema.prisma                # User and Account models (EXISTING - NO CHANGES)

tests/
├── unit/
│   └── auth/
│       ├── user-service.test.ts # Unit tests for upsert logic (NEW)
│       └── concurrent-auth.test.ts # Concurrent authentication tests (NEW)
└── e2e/
    └── auth/
        ├── first-time-signin.spec.ts # First-time user E2E test (NEW)
        └── returning-user.spec.ts    # Returning user E2E test (NEW)
```

**Structure Decision**: Next.js App Router structure with authentication logic centralized in `/app/lib/auth/`. The NextAuth configuration is extracted from the route handler into a separate config file for testability. User/Account persistence logic is isolated in a dedicated service module to enable unit testing of concurrent authentication scenarios. E2E tests validate complete authentication flows using Playwright, while unit tests verify database upsert behavior using Vitest.

## Complexity Tracking

*No constitution violations detected. This section is not applicable.*

## Post-Design Constitution Review

*Re-evaluation after Phase 1 design (research.md, data-model.md, contracts/, quickstart.md)*

### Core Principle Compliance (Re-Check)

**I. TypeScript-First Development**: ✅ PASS
- Design includes explicit TypeScript types for all callbacks
- `types/next-auth.d.ts` extends NextAuth types with custom fields
- `GitHubProfile` interface defined in contracts
- No `any` types in implementation plan

**II. Component-Driven Architecture**: ✅ PASS
- User service isolated in `app/lib/auth/user-service.ts`
- NextAuth config separated from route handler for testability
- Follows Next.js App Router conventions

**III. Test-Driven Development**: ✅ PASS
- Hybrid testing strategy documented:
  - Vitest: Unit tests for user service (`tests/unit/auth/user-service.test.ts`)
  - Playwright: E2E tests for OAuth flow (`tests/e2e/auth/first-time-signin.spec.ts`)
- Test contracts defined in `contracts/nextauth-callbacks.ts`
- TDD workflow documented in `quickstart.md`

**IV. Security-First Design**: ✅ PASS
- Email validation enforced in `validateGitHubProfile()`
- Prisma parameterized queries (upsert pattern)
- Authentication fails if database operation fails (no orphaned sessions)
- Security checklist in `contracts/README.md`

**V. Database Integrity**: ✅ PASS
- Prisma transaction ensures atomic User + Account creation
- Email uniqueness constraint used for upsert (existing schema)
- Foreign key constraint on `Account.userId` (existing schema)
- No schema migration required (existing models used)

**VI. Specification Clarification Guardrails**: ✅ PASS
- Auto-resolved decisions documented in `spec.md`
- PRAGMATIC and CONSERVATIVE policies applied appropriately
- Trade-offs documented for human review

### Design Quality Gates

**Performance Contract**: ✅ PASS
- Target: < 500ms callback execution (documented in `contracts/`)
- Connection pooling configured (10-15 connections per instance)
- Upsert pattern optimized (single query vs select + insert/update)

**Concurrency Contract**: ✅ PASS
- Upsert handles race conditions (PostgreSQL `ON CONFLICT`)
- Transaction isolation prevents partial failures
- Concurrent scenarios documented in `contracts/README.md`

**Error Handling Contract**: ✅ PASS
- Validation errors return `false` from callback
- Database errors logged with context
- No partial state (transaction rollback)

### Gate Status: ✅ APPROVED (Post-Design)

All constitution principles satisfied after design phase. Ready for Phase 2 (task generation via `/speckit.tasks`).
