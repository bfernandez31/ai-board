# Quickstart: Fix Critical Auth Bypass via Unguarded `x-test-user-id` Header

**Feature Branch**: `AIB-281-fix-critical-auth`  
**Date**: 2026-03-12

## Goal

Implement the auth fix so `x-test-user-id` is accepted only in explicit automated test contexts and never authenticates callers in non-test environments.

## Implementation Sequence

1. Add a shared helper in `/home/runner/work/ai-board/ai-board/target/lib/db/users.ts` for explicit test-context detection and guarded header resolution.
2. Refactor `getCurrentUser()`, `getCurrentUserOrNull()`, `requireAuth()`, and `getCurrentUserOrToken()` to use the guarded helper.
3. Update `/home/runner/work/ai-board/ai-board/target/proxy.ts` so `x-test-user-id` no longer skips auth middleware in non-test environments.
4. Emit explicit security log lines when non-test requests attempt to use the forbidden header.
5. Extend existing backend integration tests first; add Playwright coverage only if page-level redirect behavior cannot be asserted elsewhere.

## Test Plan

### Backend Integration

Preferred coverage per the testing skill:

- Add or extend auth-focused integration tests under `/home/runner/work/ai-board/ai-board/target/tests/integration/auth/`
- Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/tokens/api.test.ts` for representative protected endpoint behavior
- Verify:
  - header-only requests fail with `401` outside test mode
  - valid PAT requests ignore conflicting `x-test-user-id`
  - valid session requests ignore conflicting `x-test-user-id`
  - explicit test mode still allows seeded test-user override
  - unknown test user ID fails safely in test mode

### Optional E2E

Use Playwright only for browser-required assertions such as protected-page redirect behavior when `x-test-user-id` is present outside test mode.

## Validation Commands

```bash
VITEST_INTEGRATION=1 bun vitest run tests/integration/auth/test-user-header-guard.test.ts
VITEST_INTEGRATION=1 bun vitest run tests/integration/tokens/api.test.ts
VITEST_INTEGRATION=1 bun vitest run tests/integration/jobs/status.test.ts
bunx playwright test tests/e2e/auth/test-user-header-redirect.spec.ts
bun run lint
bun run type-check
```

## Expected Runtime Outcomes

- Non-test API calls with only `x-test-user-id` receive `401 Unauthorized`
- Non-test protected pages do not treat `x-test-user-id` as authenticated identity
- PAT and session auth continue to work unchanged
- Vitest and Playwright harnesses continue to authenticate seeded test users when started with `TEST_MODE=true` or `NODE_ENV=test`
- Blocked override attempts produce operator-visible `console.warn` entries from the auth helper or proxy with the route, requested user ID, and rejection reason
