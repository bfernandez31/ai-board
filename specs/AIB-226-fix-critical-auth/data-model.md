# Data Model: Fix Critical Auth Bypass

**Date**: 2026-02-24
**Branch**: `AIB-226-fix-critical-auth`

## Overview

This feature does **not** introduce any new data entities, fields, or schema changes. It is a pure logic fix to the authentication gating layer.

## Affected Data Flows

### Authentication Flow (Before Fix)

```
Request with x-test-user-id header
  ↓
proxy.ts (middleware) → preAuthCheck() → header present? → BYPASS AUTH ❌
  ↓
lib/db/users.ts → getCurrentUser() → header present? → LOOKUP USER ❌
  ↓
User impersonated without any environment check
```

### Authentication Flow (After Fix)

```
Request with x-test-user-id header
  ↓
proxy.ts (middleware) → preAuthCheck() → header present AND NODE_ENV === 'test'?
  ├── YES (test mode) → NextResponse.next() (allow through)
  └── NO (production) → fall through to NextAuth session check ✓
  ↓
lib/db/users.ts → getCurrentUser() → header present AND NODE_ENV === 'test'?
  ├── YES (test mode) → lookup user by header ID
  └── NO (production) → skip header, use NextAuth session ✓
```

## Existing Entities (Unchanged)

### User
- **No changes** — the User model is read-only in this context
- `getCurrentUser()` continues to return `{ id, email, name }` from either test header (in test mode only) or NextAuth session

## State Transitions

No state transitions affected. This fix modifies authentication gating logic only.

## Validation Rules

| Rule | Location | Behavior |
|------|----------|----------|
| Environment must be `'test'` to honor header | `proxy.ts:preAuthCheck()` | Build-time inlined check |
| Environment must be `'test'` to honor header | `lib/db/users.ts:getCurrentUser()` | Runtime check |
| Header user must exist in database | `lib/db/users.ts:getCurrentUser()` | Existing behavior, unchanged |
| Empty header treated as absent | Both locations | Falsy check covers `null` and `""` |
