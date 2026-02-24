# Quick Implementation: Copy of Fix critical auth bypass via unguarded x-test-user-id header

**Feature Branch**: `AIB-227-copy-of-fix`
**Created**: 2026-02-24
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Fix critical auth bypass via unguarded x-test-user-id header.

The `x-test-user-id` HTTP header is accepted unconditionally (no `NODE_ENV` check) in two critical locations, allowing any unauthenticated user to impersonate any other user in production.

### Affected Files
- `lib/db/users.ts:14-27` — `getCurrentUser()` accepts the header without environment guard
- `proxy.ts:10-13` — `preAuthCheck()` bypasses NextAuth entirely when the header is present

### Fix
1. `lib/db/users.ts`: Wrap header check in `if (process.env.NODE_ENV === 'test' && testUserId)`
2. `proxy.ts`: Use a build-time env variable (`NEXT_PUBLIC_TEST_MODE`) to gate the test bypass
3. Defense in depth: Strip `x-test-user-id` header in non-test environments
