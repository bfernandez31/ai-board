# Research: Fix Critical Auth Bypass via Unguarded `x-test-user-id` Header

**Feature Branch**: `AIB-281-fix-critical-auth`  
**Date**: 2026-03-12

## Decision 1: Treat only explicit automated test execution as a valid override context

**Decision**: The `x-test-user-id` override is allowed only when the process is running in an explicitly flagged test context: `process.env.TEST_MODE === 'true'` or `process.env.NODE_ENV === 'test'`.

**Rationale**:
- The current code and scripts already distinguish automated test runs with `TEST_MODE=true` and `NODE_ENV=test`.
- The spec explicitly says preview, development, and production-like environments are non-test by default.
- Basing the rule on explicit test flags avoids the unsafe historical pattern of treating any non-production runtime as trusted.

**Alternatives considered**:
- Allow override whenever `NODE_ENV !== 'production'`: rejected because local dev servers, previews, and shared environments would still accept impersonation.
- Allow override from localhost or internal IPs: rejected because network origin is not a reliable identity control in shared or proxied deployments.
- Keep override always enabled but add warning logs: rejected because logging does not remove the bypass.

## Decision 2: Centralize identity resolution so PAT and session auth always win in non-test environments

**Decision**: Introduce a single guard for test override evaluation inside the auth utility layer. In non-test environments:
- `getCurrentUser()` must ignore or reject `x-test-user-id` and rely on NextAuth session only.
- `getCurrentUserOrToken(request)` must preserve Bearer PAT precedence, then fall back to session auth, never to header-only impersonation.

**Rationale**:
- The current vulnerability exists because `getCurrentUser()` trusts the header before checking session auth.
- `getCurrentUserOrToken()` inherits the same issue by falling back to `getCurrentUser()`.
- Centralizing the rule avoids route-by-route drift and satisfies FR-008.

**Alternatives considered**:
- Patch only the vulnerable routes individually: rejected because many protected routes share `getCurrentUser()` and `requireAuth()`, so route-by-route fixes would be incomplete.
- Remove header support entirely: rejected because sanctioned automated tests still depend on the override path.
- Let PAT requests use the header in test mode too: rejected because the cleaner model is "PAT first, override only when there is no standard credential or when tests intentionally use it."

## Decision 3: Enforce defense in depth at the Next.js proxy boundary

**Decision**: Update `proxy.ts` so non-test requests carrying `x-test-user-id` do not bypass auth middleware. The proxy should fail closed for protected API requests and protected page requests instead of calling `NextResponse.next()` solely because the header is present.

**Rationale**:
- The current `preAuthCheck()` in `proxy.ts` explicitly whitelists any request containing `x-test-user-id`, which defeats the auth boundary before application logic runs.
- Fixing only the app-level helper would still leave a future regression path if proxy logic remained permissive.
- The proxy is the correct boundary layer already responsible for route gating and redirect behavior.

**Alternatives considered**:
- Rely only on app-level auth helpers: rejected because the spec requires platform-layer defense beyond a single application check.
- Strip the header silently and continue: partially acceptable, but rejected as the primary design because the spec wants blocked use to be visible to operators.
- Add CDN/WAF header filtering: rejected for now because this repo’s directly owned boundary is `proxy.ts`, and the deployment contract does not currently encode external edge rules.

## Decision 4: Use existing structured server logs as the security validation signal

**Decision**: Blocked uses of `x-test-user-id` outside test mode will emit explicit security-oriented log entries from the proxy and/or auth utility path, including route and enforcement reason, without adding a new database table.

**Rationale**:
- The codebase already uses structured `console.error` and `console.warn` logging for operational signals.
- The spec requires observability, not a new persistence model.
- Avoiding schema changes keeps the fix small and fast while still making validation evidence available in normal deployment logs and test output.

**Alternatives considered**:
- Create a new `SecurityEvent` database table: rejected as unnecessary for the incident fix and disproportionate to the implementation scope.
- Return only generic 401 responses with no logs: rejected because reviewers need a way to verify blocked attempts.
- Add a third-party SIEM integration: rejected because no such infrastructure exists in the current repository and it is outside the feature scope.

## Decision 5: Prefer backend integration tests, with only narrow E2E coverage for redirect behavior

**Decision**: Cover the fix primarily with Vitest integration tests against protected API endpoints and auth utilities, and use Playwright only if page-level redirect behavior needs a real browser assertion.

**Rationale**:
- The repo constitution and testing skill require API auth verification to default to backend integration tests.
- The affected logic sits in request auth helpers and proxy behavior, which is well-suited to integration coverage.
- Browser-only checks are only needed where redirect UX, cookies, or proxy interaction cannot be asserted through integration.

**Alternatives considered**:
- Use E2E only: rejected because it is slower and unnecessary for most affected paths.
- Use unit tests only: rejected because the risk is in end-to-end request auth composition, not isolated pure functions.
- Skip tests because this is a “small” security patch: rejected because the constitution requires verified behavior.
