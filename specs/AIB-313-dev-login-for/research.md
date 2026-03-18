# Research: Dev Login for Preview Environments

**Date**: 2026-03-18 | **Feature**: AIB-313

## R1: How should preview-only availability be enforced?

**Decision**: Gate dev login behind `VERCEL_ENV=preview`, `DEV_LOGIN_ENABLED=true`, and a configured `DEV_LOGIN_SECRET`, with the same predicate used by both the UI and the credentials authorization path.

**Rationale**: The live codebase has no existing preview-auth toggle, and the spec explicitly requires the feature to be unavailable in production. Reusing one server-side predicate for provider authorization and sign-in-page rendering prevents the page from exposing unavailable controls and prevents direct POSTs from bypassing UI hiding.

**Alternatives considered**:
- `NODE_ENV !== "production"`: rejected because it would expose dev login in local development and does not satisfy preview-only scope.
- UI-only hiding: rejected because direct requests to the credentials callback would still be possible.
- Database-backed deployment config: rejected for this ticket because the spec describes deployment-level configuration and the project already relies on environment configuration for secrets.

## R2: Where should credentials validation and provisioning happen?

**Decision**: Put dev-login validation and user provisioning inside a dedicated helper called by the NextAuth `Credentials` provider `authorize()` function.

**Rationale**: [`lib/auth.ts`](/home/runner/work/ai-board/ai-board/target/lib/auth.ts) is the actual auth entry point, and its `signIn` callback currently rejects non-GitHub providers. Handling credentials in `authorize()` lets the provider return a fully provisioned user object with the database `id`, which works with the existing JWT/session callbacks and isolates the credentials-specific logic from the GitHub OAuth path.

**Alternatives considered**:
- Provision inside `callbacks.signIn`: rejected because the callback is already provider-specific and currently optimized for GitHub profile/account payloads.
- Separate custom API route: rejected because NextAuth already owns session creation and callback handling.

## R3: How should first-time dev-login users be represented in the database?

**Decision**: Reuse existing users by normalized email and create new dev-login-only users with `crypto.randomUUID()` IDs plus a credentials `Account` record keyed by normalized email.

**Rationale**: Existing GitHub provisioning uses numeric GitHub IDs as `User.id`, so generating another provider-derived ID risks collisions and inconsistent ownership references. Email is the stable identity requirement in the spec, while a UUID is safe for first-time credentials-created users. Recording a credentials `Account` row preserves parity with other auth methods and gives the login path an explicit provider linkage.

**Alternatives considered**:
- Use email as `User.id`: rejected because it would diverge from the current schema conventions and create migration pressure later.
- Create only `User` and skip `Account`: rejected because the existing auth model already represents provider linkages explicitly.
- Generate a deterministic prefixed ID from email: rejected because it adds complexity without improving correctness over UUIDs.

## R4: What is the safest failure UX?

**Decision**: Return a generic sign-in failure back to `/auth/signin` using a stable error key such as `error=dev-login`, and render a non-sensitive inline message on the sign-in page.

**Rationale**: The spec requires a user-visible error while forbidding disclosure of the configured secret. The current error page only maps generic NextAuth error types and is not optimized for credentials retries. Redirecting back to the sign-in page keeps the retry flow tight and avoids leaking whether the email, secret, or environment gate failed.

**Alternatives considered**:
- Let NextAuth render the default `CredentialsSignin` error flow: rejected because the current UX would be less specific and may bounce users to a generic auth error page.
- Expose distinct errors for invalid email vs invalid secret: rejected because it increases information disclosure without helping preview testers enough to justify the risk.

## R5: What is the minimum effective automated coverage?

**Decision**: Use unit + component + integration tests as the main coverage, with at most one minimal E2E test for the real browser submit/redirect path.

**Rationale**: Existing auth E2E coverage mostly manipulates Prisma directly and does not validate the real sign-in surface. The critical risk here is server-side auth behavior and provisioning, which is best covered by integration tests. Only the final form submission and redirect truly require a browser.

**Alternatives considered**:
- Heavy E2E coverage for all scenarios: rejected because the repo guidance explicitly says E2E is expensive and auth logic can be verified faster with Vitest.
- Component-only coverage: rejected because it would miss the real credentials authorization and persistence path.

## R6: Which source of truth should drive this plan?

**Decision**: Treat live implementation files as the source of truth, and treat older auth documentation as reference only.

**Rationale**: [`specs/specifications/technical/implementation/authentication.md`](/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/implementation/authentication.md) describes older behavior that does not fully match the current [`lib/auth.ts`](/home/runner/work/ai-board/ai-board/target/lib/auth.ts). Planning against outdated docs would produce the wrong integration surface.

**Alternatives considered**:
- Follow the implementation doc literally: rejected because it conflicts with the current code.

## Unknowns Resolved

All Technical Context unknowns are resolved:
- Preview-only gating: environment-based server predicate
- Auth extension point: `Credentials.authorize()` in `lib/auth.ts`
- User/account persistence model: reuse by email, create new users with UUIDs
- Failure UX: inline generic retry message on `/auth/signin`
- Test scope: unit + component + integration, plus one minimal E2E if redirect needs proof
