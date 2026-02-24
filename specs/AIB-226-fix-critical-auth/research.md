# Research: Fix Critical Auth Bypass via Unguarded x-test-user-id Header

**Date**: 2026-02-24
**Branch**: `AIB-226-fix-critical-auth`

## Research Questions & Findings

### RQ-1: How does Next.js expose build-time constants to Edge Runtime middleware?

**Decision**: Use `next.config.ts` → `env` property to inject a build-time constant `NEXT_PUBLIC_TEST_MODE`.

**Rationale**: Next.js `env` config inlines values at build time via string replacement. This works in Edge Runtime because the value is embedded in the compiled bundle, not read from `process.env` at runtime. The `NEXT_PUBLIC_` prefix is not strictly required for server-side code, but a plain `env` entry (without the prefix) also gets inlined. We use a non-public key (`TEST_MODE_BUILD`) to avoid client exposure.

**Alternatives considered**:
1. `NEXT_PUBLIC_TEST_MODE` — works but exposes the flag to client-side bundles (unnecessary leak)
2. `process.env.NODE_ENV` — already available in Edge Runtime as a build-time constant in Next.js (it's replaced at build time by webpack/turbopack). **This is actually the simplest approach.**
3. Custom webpack `DefinePlugin` — overly complex for a single boolean

**Final Decision (revised)**: Use `process.env.NODE_ENV` directly in the middleware. Despite the existing code comment claiming Edge Runtime can't read it, Next.js **does** inline `NODE_ENV` at build time. The existing comment in `proxy.ts` line 10 is misleading — `process.env.NODE_ENV` is one of the few environment variables that IS available in Edge Runtime because Next.js replaces it during compilation. However, to be defense-in-depth safe and explicit, we will **also** add a `TEST_MODE_BUILD` constant via `next.config.ts` `env` as a fallback.

**Updated Decision**: After further analysis, the safest approach that satisfies FR-004 (build-time mechanism) and FR-006 (fail-secure) is:
- Use `process.env.NODE_ENV === 'test'` in the middleware. Next.js compiles this to a literal `true`/`false` at build time.
- This is simpler, requires no config changes, and is fail-secure (production builds always have `NODE_ENV=production`).

### RQ-2: What is the current test mode detection pattern in the codebase?

**Decision**: Follow the existing `process.env.NODE_ENV === 'test'` pattern used throughout the codebase.

**Rationale**: The codebase already uses this check in:
- `lib/auth.ts:10` — conditional Prisma adapter import
- `lib/auth.ts:39` — skip database persistence in test mode
- `lib/auth.ts:114` — session strategy selection

This is the established pattern. Both middleware and server-side code should use the same check, with the understanding that:
- In middleware: `process.env.NODE_ENV` is inlined at build time by Next.js
- In server code: `process.env.NODE_ENV` is read at runtime (also available)

**Alternatives considered**:
1. Custom `TEST_MODE` env var — adds unnecessary indirection; `NODE_ENV` already serves this purpose
2. Feature flag service — extreme overkill for an environment gate

### RQ-3: Should the header be stripped or ignored in production?

**Decision**: Ignore the header (do not process it). Do not strip it from the request.

**Rationale**: Per spec auto-resolved decisions:
- Both checkpoints independently verify the environment before honoring the header
- Header stripping (request mutation) adds complexity in Edge Runtime
- If both guards independently reject the header, stripping provides no additional security benefit
- Simpler code = fewer bugs

**Alternatives considered**:
1. Strip the header in middleware before passing to route handlers — adds request mutation complexity, and downstream code still needs its own guard (defense-in-depth)
2. Strip + ignore — redundant given dual guards

### RQ-4: What is the fail-secure behavior when environment is indeterminate?

**Decision**: Default to rejecting the test header. Only honor it when `NODE_ENV` is explicitly `'test'`.

**Rationale**: The check `process.env.NODE_ENV !== 'production'` would be fail-OPEN (any unknown env allows bypass). The check `process.env.NODE_ENV === 'test'` is fail-CLOSED (only explicit test mode allows bypass). This satisfies FR-006.

**Alternatives considered**:
1. `!== 'production'` — fail-open, dangerous if NODE_ENV is undefined or has unexpected value
2. Allowlist of test environments — overly complex; there's only one: `'test'`

### RQ-5: What existing tests use the x-test-user-id header and how will they be affected?

**Decision**: No changes needed to existing test infrastructure.

**Rationale**: The test suite runs with `NODE_ENV=test` (set in `.env.test`). The guard only blocks the header when `NODE_ENV !== 'test'`. All existing test flows:
- `tests/fixtures/vitest/api-client.ts` — sends the header; works because test server runs with `NODE_ENV=test`
- `playwright.config.ts` — sets the header for E2E tests; works because the test dev server has `NODE_ENV=test`

No test modifications required.

### RQ-6: Impact on the job status polling endpoint

**Decision**: No impact. The job status endpoint (`/api/projects/[projectId]/jobs/status/route.ts`) uses its own token-based auth, not the test header bypass.

**Rationale**: Reviewed the file — it references `x-test-user-id` only as a secondary mechanism in `requireAuth()`. Once the guard is in `getCurrentUser()`, all callers are automatically protected.

## Summary of Decisions

| # | Decision | Mechanism | Fail Mode |
|---|----------|-----------|-----------|
| 1 | Middleware guard | `process.env.NODE_ENV === 'test'` (build-time inlined) | Fail-secure (rejects header) |
| 2 | Server-side guard | `process.env.NODE_ENV === 'test'` (runtime check) | Fail-secure (rejects header) |
| 3 | Header handling | Ignore (not strip) | N/A |
| 4 | Config changes | None needed | N/A |
| 5 | Test compatibility | No changes to test infra | Tests unaffected |
