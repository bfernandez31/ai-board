# Quickstart: Dev Login for Preview Environments

**Feature**: AIB-313 | **Branch**: `AIB-313-dev-login-for`

## Environment Setup

Set preview-only configuration:

```bash
export VERCEL_ENV=preview
export DEV_LOGIN_ENABLED=true
export DEV_LOGIN_SECRET='shared-preview-secret'
```

Keep production without these values, or with `VERCEL_ENV=production`, so the feature stays unavailable.

## Implementation Order

1. Add a dedicated `app/lib/auth/dev-login.ts` helper for:
   - preview gating predicate
   - Zod credential validation
   - secure secret comparison
   - transactional user/account provisioning
2. Extend [`lib/auth.ts`](/home/runner/work/ai-board/ai-board/target/lib/auth.ts) with a `Credentials` provider that calls the helper from `authorize()`, and update callbacks so GitHub and credentials providers both succeed on their intended paths.
3. Update [`app/auth/signin/page.tsx`](/home/runner/work/ai-board/ai-board/target/app/auth/signin/page.tsx) to:
   - conditionally render the dev-login form only when enabled
   - preserve the GitHub button in all environments
   - show a generic retry-safe error message for `error=dev-login`
4. Update [`app/auth/error/page.tsx`](/home/runner/work/ai-board/ai-board/target/app/auth/error/page.tsx) only if the chosen UX still routes certain credential failures through the error page.
5. Add automated coverage in this order:
   - unit tests for helper predicates/validation
   - component tests for sign-in-page enabled/disabled/error states
   - integration tests for successful and failed credentials auth flows
   - one minimal E2E for browser redirect behavior if needed

## Verification Steps

1. `bun run test:unit`
2. `bun run test:integration`
3. `bun run test:e2e` only for the minimal preview sign-in browser flow if implemented
4. `bun run type-check`
5. `bun run lint`

## Scenario Checklist

- Enabled preview environment shows email + shared-secret form
- Disabled or production environment shows only GitHub sign-in
- Valid credentials create or reuse a user and redirect to `/projects`
- Existing users keep their prior project/ticket access after dev login
- Invalid secret or invalid email keeps the user signed out and shows a generic error
- No secret appears in UI, logs, or response payloads
