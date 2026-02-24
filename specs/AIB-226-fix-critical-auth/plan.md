# Implementation Plan: Fix Critical Auth Bypass via Unguarded x-test-user-id Header

**Branch**: `AIB-226-fix-critical-auth` | **Date**: 2026-02-24 | **Spec**: `specs/AIB-226-fix-critical-auth/spec.md`
**Input**: Feature specification from `/specs/AIB-226-fix-critical-auth/spec.md`

## Summary

The `x-test-user-id` header is accepted as an authentication bypass in **all environments**, including production. Both authentication checkpoints — the Edge Runtime middleware (`proxy.ts`) and the server-side user lookup (`lib/db/users.ts`) — honor this header without any environment verification. The fix applies defense-in-depth gating: a **build-time constant** in the middleware (Edge Runtime constraint) and a **runtime `process.env.NODE_ENV` check** in the server-side user lookup. Test mode functionality is preserved.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), NextAuth.js, Prisma 6.x
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Vercel (Edge Runtime for middleware, Node.js for API routes)
**Project Type**: Web application (Next.js monolith)
**Performance Goals**: N/A (security fix, no performance impact)
**Constraints**: Edge Runtime middleware cannot read `process.env.NODE_ENV` at runtime — requires build-time constant
**Scale/Scope**: 2 files modified, 1 file updated (next.config.ts), plus new security tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All changes in TypeScript strict mode with explicit types |
| II. Component-Driven Architecture | PASS | No UI changes — server-side auth fix only |
| III. Test-Driven Development | PASS | Security tests required: integration tests for auth bypass rejection + test mode acceptance |
| IV. Security-First Design | PASS | This fix directly addresses a critical security vulnerability (defense-in-depth) |
| V. Database Integrity | PASS | No schema changes |
| VI. AI-First Development | PASS | No documentation files created at root |

**Gate Result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-226-fix-critical-auth/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal — no new entities)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── auth-guards.ts   # Contract for environment gating functions
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
# Modified files
proxy.ts                          # Add build-time environment guard to preAuthCheck()
lib/db/users.ts                   # Add runtime NODE_ENV guard to getCurrentUser()
next.config.ts                    # Expose NEXT_PUBLIC_TEST_MODE build-time constant

# New test files
tests/integration/auth/           # New directory for auth security tests
└── test-header-bypass.test.ts    # Integration tests for header bypass prevention
```

**Structure Decision**: Single Next.js monolith — all changes within existing structure. No new directories except the auth test directory under `tests/integration/`.

## Complexity Tracking

*No constitution violations — no entries needed.*
