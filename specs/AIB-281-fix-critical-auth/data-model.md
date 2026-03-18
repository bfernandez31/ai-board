# Data Model: Fix Critical Auth Bypass via Unguarded `x-test-user-id` Header

**Feature Branch**: `AIB-281-fix-critical-auth`  
**Date**: 2026-03-12

## Overview

**No Prisma schema changes are required.**

This feature changes runtime authentication policy around existing request and identity objects. The core design introduces a stricter evaluation model for test impersonation without adding tables or columns.

## Existing Runtime Entities

### Authenticated Identity

The resolved user identity used for authorization decisions on protected pages and API routes.

| Field | Type | Notes |
|-------|------|-------|
| id | string | Prisma `User.id`, used by access-control helpers |
| email | string | Present for session and PAT identity resolution |
| name | string \| null | Display-only field returned from auth helpers |
| source | `'session' \| 'pat' \| 'test-override'` | Runtime-only provenance, useful for reasoning and tests |

**Validation rules**:
- `source='session'` requires a valid NextAuth session with `session.user.id`
- `source='pat'` requires a valid `Authorization: Bearer pat_*` token
- `source='test-override'` is valid only in explicit test context and only for an existing seeded test user

### Test Identity Override Header

Runtime representation of the `x-test-user-id` request header.

| Field | Type | Notes |
|-------|------|-------|
| headerName | string | Constant: `x-test-user-id` |
| requestedUserId | string | Raw header value from request |
| allowed | boolean | Whether current environment permits override evaluation |
| rejectionReason | `'not-test-context' \| 'user-not-found' \| 'disallowed-route' \| null` | Runtime-only enforcement reason |

**Validation rules**:
- Header presence alone never authenticates a caller outside explicit test mode
- Unknown or deleted user IDs fail closed
- Non-test environments must never switch identity because of this header

### Protected Request

Request categories that depend on current-user resolution.

| Field | Type | Notes |
|-------|------|-------|
| path | string | Requested pathname or API route |
| requestType | `'page' \| 'api'` | Determines redirect vs JSON error handling |
| hasSession | boolean | Whether a valid session is present |
| hasPat | boolean | Whether a valid PAT is present |
| hasTestOverrideHeader | boolean | Whether `x-test-user-id` was supplied |
| environmentClass | `'test' \| 'non-test'` | Derived from explicit runtime flags |

**Validation rules**:
- Non-test + header-only request => unauthenticated failure
- Non-test + valid session/PAT + conflicting header => preserve standard credential identity
- Test + valid seeded test header => allow override path

## Relationships

### Identity Resolution Flow

```
ProtectedRequest
  -> PersonalAccessToken?        (highest precedence when present and valid)
  -> Session?                    (standard authenticated browser/user flow)
  -> TestIdentityOverrideHeader? (allowed only in explicit test context)
  -> Unauthorized
```

### Boundary Enforcement Flow

```
proxy.ts
  -> evaluates ProtectedRequest + TestIdentityOverrideHeader
  -> blocks forbidden non-test header usage before app code
  -> passes allowed requests to route/page handlers

lib/db/users.ts
  -> resolves AuthenticatedIdentity consistently for all protected handlers
```

## State Transitions

### Header Override Policy

1. `HeaderAbsent`
2. `HeaderPresent`
3. `HeaderRejected`
4. `HeaderAcceptedForTest`

**Transitions**:
- `HeaderAbsent -> HeaderPresent`: request includes `x-test-user-id`
- `HeaderPresent -> HeaderRejected`: environment is non-test, route disallows override, or requested user does not exist
- `HeaderPresent -> HeaderAcceptedForTest`: explicit test context and seeded user lookup succeeds
- `HeaderRejected -> Unauthorized`: no valid session or PAT remains
- `HeaderRejected -> SessionOrPatIdentity`: valid standard credentials remain and continue unchanged

## Affected Existing Code Paths

| Path | Current Role | Required Change |
|------|--------------|-----------------|
| `/home/runner/work/ai-board/ai-board/target/proxy.ts` | Pre-auth boundary | Remove unconditional allowlist for `x-test-user-id` in non-test environments |
| `/home/runner/work/ai-board/ai-board/target/lib/db/users.ts` | User/session/PAT resolution | Make override test-only and keep PAT/session precedence |
| `/home/runner/work/ai-board/ai-board/target/lib/db/auth-helpers.ts` | Project/ticket auth wrappers | Inherit centralized fix via `requireAuth()` |
| `/home/runner/work/ai-board/ai-board/target/tests/fixtures/vitest/api-client.ts` | Test harness header injection | Continue using header only in explicit automated test mode |

## Invariants

- `x-test-user-id` never authenticates a non-test request.
- Valid PAT or session credentials are never replaced by header identity in non-test environments.
- All protected routes derive identity from the same guarded auth helper path.
- Blocked non-test header attempts produce an observable security signal.
