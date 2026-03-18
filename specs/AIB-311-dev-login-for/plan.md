# Implementation Plan: Dev Login for Preview Environments

**Feature Branch**: `AIB-311-dev-login-for`
**Created**: 2026-03-18
**Status**: Ready for Implementation

## Technical Context

| Aspect | Details |
|--------|---------|
| **Auth Framework** | NextAuth.js v5 (Auth.js) with JWT strategy (prod) / database strategy (test) |
| **Auth Config** | `lib/auth.ts` — single NextAuth export with GitHub provider |
| **Signin Page** | `app/auth/signin/page.tsx` — server component with server action for GitHub |
| **User Service** | `app/lib/auth/user-service.ts` — GitHub-specific user upsert |
| **Middleware** | `proxy.ts` — auth proxy with PAT and test-user-id bypass |
| **Prisma Schema** | User model with `id` (String), `email` (unique), `name`, `image` |
| **Session Management** | JWT callbacks set `token.id`/`token.userId` from `user.id` |
| **Existing Test Auth** | `x-test-user-id` header bypass in proxy.ts + `getCurrentUser()` |
| **Schema Changes** | None required — existing User model is sufficient |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code will be strictly typed, no `any` |
| II. Component-Driven | PASS | DevLoginForm uses shadcn/ui components (Input, Button, Label, Card) |
| III. Test-Driven | PASS | Integration tests for authorize logic, component test for form |
| IV. Security-First | PASS | Timing-safe comparison, server-side secret, Zod validation |
| V. Database Integrity | PASS | Uses Prisma upsert, no raw SQL, no schema changes |
| VI. AI-First Development | PASS | No documentation files created |

## Implementation Tasks

### Task 1: Add Credentials Provider to NextAuth Config
**File**: `lib/auth.ts`
**Priority**: P0 (blocks all other tasks)
**Requirements**: FR-001, FR-003, FR-005, FR-008, FR-009

**Changes**:
1. Import `Credentials` from `next-auth/providers/credentials`
2. Create `devLoginProvider()` function that returns `Credentials({...})` only when `process.env.DEV_LOGIN_SECRET` is set
3. Add the provider conditionally to the `providers` array: `...(process.env.DEV_LOGIN_SECRET ? [devLoginProvider()] : [])`
4. The `authorize` callback:
   - Receives `{ email, secret }` from credentials
   - Validates both fields are non-empty
   - Normalizes email to lowercase (FR-010)
   - Compares `secret` against `DEV_LOGIN_SECRET` using `crypto.timingSafeEqual` (FR-003)
   - On match: calls `createOrUpdateDevUser(email)` and returns user object
   - On mismatch: returns `null`
5. Update `signIn` callback to handle Credentials provider (skip GitHub-specific validation when `account?.provider === 'credentials'`)
6. The `jwt` callback already handles setting `token.id` from `user.id` — no changes needed

**Estimated complexity**: Medium

### Task 2: Add Dev User Upsert Function
**File**: `app/lib/auth/user-service.ts`
**Priority**: P0 (required by Task 1)
**Requirements**: FR-004, FR-010

**Changes**:
1. Add `createOrUpdateDevUser(email: string): Promise<{ id: string; email: string; name: string }>` function
2. Normalize email to lowercase
3. Generate deterministic ID: `crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 24)`
4. Derive display name from email prefix (part before `@`)
5. Prisma `upsert` by email:
   - **Create**: id, email (lowercase), name (email prefix), emailVerified (now), updatedAt (now)
   - **Update**: updatedAt (now) — don't overwrite name/image if user exists (may have GitHub data)

**Estimated complexity**: Low

### Task 3: Create DevLoginForm Client Component
**File**: `components/auth/dev-login-form.tsx` (new)
**Priority**: P1
**Requirements**: FR-002, FR-006, FR-007

**Changes**:
1. `"use client"` component with `useState` for email, secret, error, loading
2. Uses shadcn/ui: `Input`, `Button`, `Label` components
3. Client-side validation: both fields required, email format check
4. On submit: call `signIn("credentials", { email, secret, redirect: false })` from `next-auth/react`
5. On success (`result.ok`): redirect to callbackUrl using `router.push()`
6. On failure: display error message ("Invalid credentials")
7. Accept `callbackUrl` prop from parent

**Estimated complexity**: Low

### Task 4: Update Signin Page
**File**: `app/auth/signin/page.tsx`
**Priority**: P1 (depends on Task 3)
**Requirements**: FR-002, FR-009

**Changes**:
1. Import `DevLoginForm` component
2. Read `process.env.NEXT_PUBLIC_DEV_LOGIN` at server render time
3. Conditionally render `<DevLoginForm callbackUrl={callbackUrl} />` below the GitHub button (above the disabled providers) when env var is `"true"`
4. Add a visual separator (`<div>` with "or" text) between GitHub and Dev Login when both are shown

**Estimated complexity**: Low

### Task 5: Update Environment Variable Examples
**Files**: `.env.example`
**Priority**: P2
**Requirements**: FR-008

**Changes**:
1. Add `DEV_LOGIN_SECRET=` (empty, with comment: "Set to a 32+ char secret to enable dev login on preview environments")
2. Add `NEXT_PUBLIC_DEV_LOGIN=` (empty, with comment: "Set to 'true' to show dev login form")

**Estimated complexity**: Trivial

## Testing Strategy

### Integration Tests (Vitest)
**File**: `tests/integration/auth/dev-login.test.ts` (new)
**Covers**: Tasks 1, 2

| Test Case | Type | Requirement |
|-----------|------|-------------|
| `authorize` returns user for correct secret | Integration | FR-003, FR-004, FR-005 |
| `authorize` returns null for incorrect secret | Integration | FR-003, FR-007 |
| `authorize` returns null for empty email | Integration | FR-003 |
| `authorize` returns null for empty secret | Integration | FR-003 |
| `createOrUpdateDevUser` creates new user with correct fields | Integration | FR-004 |
| `createOrUpdateDevUser` upserts existing user without overwriting name | Integration | FR-004 |
| Email normalization (case-insensitive) | Integration | FR-010 |
| Credentials provider not in providers when `DEV_LOGIN_SECRET` unset | Integration | FR-009 |
| Timing-safe comparison works for different-length secrets | Integration | FR-003 |

### Component Tests (Vitest + RTL)
**File**: `tests/unit/components/dev-login-form.test.tsx` (new)
**Covers**: Task 3

| Test Case | Type | Requirement |
|-----------|------|-------------|
| Form renders email and secret inputs | Component | FR-002 |
| Submit button is disabled when fields are empty | Component | FR-002 |
| Displays error message on failed login | Component | FR-007 |
| Calls signIn with correct parameters on submit | Component | FR-005 |

### Existing Test Impact
**SC-005**: All existing tests must pass unchanged. This feature:
- Does NOT modify existing GitHub OAuth flow
- Does NOT change User schema
- Does NOT affect test auto-login (`x-test-user-id` header)
- Only adds code paths gated by `DEV_LOGIN_SECRET` (unset in test env)

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `lib/auth.ts` | Modify | Add conditional Credentials provider, update signIn callback |
| `app/lib/auth/user-service.ts` | Modify | Add `createOrUpdateDevUser` function |
| `components/auth/dev-login-form.tsx` | Create | Client-side dev login form component |
| `app/auth/signin/page.tsx` | Modify | Conditionally render DevLoginForm |
| `.env.example` | Modify | Add DEV_LOGIN_SECRET and NEXT_PUBLIC_DEV_LOGIN |
| `tests/integration/auth/dev-login.test.ts` | Create | Integration tests for authorize + user service |
| `tests/unit/components/dev-login-form.test.tsx` | Create | Component tests for form |

## Dependency Graph

```
Task 2 (user-service) ─┐
                        ├→ Task 1 (auth config) → Task 4 (signin page)
Task 3 (form component)─┘                              │
                                                        ↓
                                                   Task 5 (env example)
```

**Execution order**: Task 2 → Task 1 → Task 3 → Task 4 → Task 5

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| NextAuth v5 Credentials + JWT incompatibility | Low | High | Test authorize → jwt → session callback chain end-to-end |
| Secret leaked to client bundle | Low | Critical | `DEV_LOGIN_SECRET` has no `NEXT_PUBLIC_` prefix; verified by checking bundle output |
| Existing tests break | Very Low | Medium | No schema changes, no modifications to existing auth flows |
| Timing attack on secret | Low | Medium | Using `crypto.timingSafeEqual` with buffer padding |
