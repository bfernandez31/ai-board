# Implementation Plan: Fix Critical Auth Bypass via Unguarded `x-test-user-id` Header

**Branch**: `AIB-281-fix-critical-auth` | **Date**: 2026-03-12 | **Spec**: [/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/spec.md](./spec.md)
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/spec.md`

## Summary

Close the current authentication bypass by making `x-test-user-id` usable only in explicitly sanctioned automated test execution, while preserving normal session and personal access token authentication everywhere else. The implementation will centralize the override guard in the auth helpers, block the header at the Next.js proxy boundary for non-test environments, and emit consistent security signals so blocked impersonation attempts are visible during verification.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 App Router, React 18, NextAuth 5 beta, Prisma 6.x, Zod  
**Storage**: PostgreSQL 14+ via Prisma ORM (no schema changes planned)  
**Testing**: Vitest unit and integration tests, Playwright E2E for auth/browser regression coverage  
**Target Platform**: Next.js web application on Vercel and local/Linux CI test runners  
**Project Type**: Web application  
**Performance Goals**: No measurable regression to protected-route auth latency; auth guard remains O(1) header/env checks plus existing session or PAT validation  
**Constraints**: `x-test-user-id` must work only when `TEST_MODE=true` or `NODE_ENV=test`; preview, development, and production environments are non-test by default; existing PAT and NextAuth flows must remain backward compatible  
**Scale/Scope**: Shared auth path used by protected pages, API routes, and Vitest/Playwright harnesses across the application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | Auth guard changes stay in strict TypeScript utilities and route handlers |
| II. Component-Driven | PASS | Changes are server/auth focused; existing Next.js route and lib structure remains intact |
| III. Test-Driven Development | PASS | Existing auth and API suites will be extended first; backend integration is the default test layer |
| IV. Security-First | PASS | Work directly removes an auth bypass and adds fail-closed validation plus boundary enforcement |
| V. Database Integrity | PASS | No Prisma schema or data model migration required |
| V. Clarification Guardrails | PASS | Spec already records conservative, security-first auto decisions |
| VI. AI-First Development | PASS | Artifacts stay inside `/specs/AIB-281-fix-critical-auth/` with no root-level docs |

**Pre-Design Gate Result**: PASS

## Project Structure

### Documentation (this feature)

```
/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── auth-override-guard.yaml
└── tasks.md
```

### Source Code (repository root)

```
/home/runner/work/ai-board/ai-board/target/
├── proxy.ts                                 # Boundary control for protected requests
├── lib/
│   ├── auth.ts                              # NextAuth session behavior reference
│   ├── db/
│   │   ├── users.ts                         # Current user resolution and PAT fallback
│   │   └── auth-helpers.ts                  # Project/ticket authorization helpers
│   └── tokens/
│       └── validate.ts                      # PAT validation path preserved
├── app/
│   └── api/
│       ├── tokens/
│       │   ├── route.ts                     # Representative protected PAT-capable endpoint
│       │   └── [id]/route.ts
│       ├── notifications/
│       │   └── route.ts                     # Representative session-only protected endpoint
│       └── projects/[projectId]/jobs/status/
│           └── route.ts                     # Representative protected route using requireAuth()
└── tests/
    ├── fixtures/vitest/
    │   ├── api-client.ts                    # Test-only header injection path
    │   └── setup.ts
    ├── integration/
    │   ├── auth/                            # New or extended auth integration coverage
    │   └── tokens/                          # Existing protected API coverage to extend
    └── e2e/auth/                            # Browser-level regression checks if needed
```

**Structure Decision**: Reuse the existing Next.js auth stack and test harness. The fix belongs in centralized request-auth utilities plus `proxy.ts`, with tests centered in Vitest integration suites and only minimal E2E coverage for redirect/browser behavior.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0 Research Output

Research tasks resolved in [/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/research.md](./research.md):

1. Define the sanctioned test context predicate for header-based impersonation.
2. Determine how to preserve PAT precedence while removing header-based fallback in non-test environments.
3. Choose a boundary-layer control in `proxy.ts` that prevents future regressions from re-exposing the header externally.
4. Define verification signals for blocked attempts that satisfy security review requirements without adding new infrastructure.

## Phase 1 Design Output

Phase 1 artifacts are:

- [/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/data-model.md](./data-model.md)
- [/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/contracts/auth-override-guard.yaml](./contracts/auth-override-guard.yaml)
- [/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/quickstart.md](./quickstart.md)

## Constitution Check (Post-Design)

### Post-Design Check

| Principle | Status | Verification |
|-----------|--------|--------------|
| I. TypeScript-First | PASS | Design keeps guard logic in typed auth helpers and typed API contract schemas |
| II. Component-Driven | PASS | No new architectural pattern introduced; existing `lib/` and App Router boundaries preserved |
| III. Test-Driven Development | PASS | Test plan uses backend integration first, with focused browser coverage only for redirect/auth UX |
| IV. Security-First | PASS | Header override is fail-closed outside explicit test mode, with proxy-layer defense in depth and audit signals |
| V. Database Integrity | PASS | No schema changes; all identity lookups continue through Prisma queries |
| V. Clarification Guardrails | PASS | Research resolves all prior ambiguities without weakening security defaults |
| VI. AI-First Development | PASS | All artifacts remain in the ticket spec directory and update only agent context metadata |

**Post-Design Gate Result**: PASS

### Ready for Task Generation

All design artifacts are complete, all clarification points are resolved, and no constitution gates remain open. The feature is ready for Phase 2 task generation.
