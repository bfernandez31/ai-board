# Implementation Plan: Dev Login for Preview Environments

**Branch**: `AIB-313-dev-login-for` | **Date**: 2026-03-18 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-313-dev-login-for/spec.md`
**Input**: Feature specification from `/specs/AIB-313-dev-login-for/spec.md`

## Summary

Add a preview-only credentials sign-in path to the existing NextAuth setup by introducing a gated `Credentials` provider, a shared dev-login validation/provisioning helper, and a conditional form on `/auth/signin`. Successful dev-login attempts will create or reuse the existing `User` record, optionally record a credentials `Account` linkage, establish a normal authenticated session, and redirect to `/projects`; disabled environments and invalid attempts will preserve the current GitHub-only behavior.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 (App Router), React 18, NextAuth.js 5, Prisma 6.x, Zod, shadcn/ui, TailwindCSS 3.4  
**Storage**: PostgreSQL 14+ via Prisma ORM (reusing existing `User`, `Account`, and `Session` models; no schema changes planned)  
**Testing**: Vitest (unit + component + integration), Playwright (minimal browser E2E only for end-to-end sign-in redirect)  
**Target Platform**: Vercel preview deployments and local test runtime for automated validation  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: No additional round trips beyond the existing sign-in submission; dev-login validation should add only one transactional database operation on success  
**Constraints**: Must never expose dev login in production; must validate email/secret before session creation; must not leak the configured secret in UI or logs; must preserve existing GitHub sign-in behavior when disabled; must use environment variables for secret/configuration  
**Scale/Scope**: ~8-12 touched files across auth config, sign-in UI, auth helper modules, and auth-focused tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | New auth helpers and UI changes stay in strict TypeScript with explicit return types and typed auth payloads. |
| II. Component-Driven Architecture | PASS | UI changes stay within `app/auth/` and `components/ui/` composition; server-side auth logic remains in `lib/auth.ts` and auth utilities. |
| III. Test-Driven Development | PASS | Plan includes unit tests for predicates/validation, component coverage for sign-in rendering, integration coverage for auth provisioning, and at most one browser E2E for real redirect behavior. |
| IV. Security-First Design | PASS | Design uses Zod validation, environment-variable secrets, preview-only gating, generic failure messaging, and no sensitive data in responses. |
| V. Database Integrity | PASS | Reuses existing Prisma models and a transaction for successful provisioning; no schema migration required. |
| VI. AI-First Development | PASS | All generated artifacts remain inside `specs/AIB-313-dev-login-for/`; no root documentation changes. |

**Post-Phase 1 Re-check**: PASS. Design keeps all gates satisfied with no justified violations.

## Project Structure

### Documentation (this feature)

```
specs/AIB-313-dev-login-for/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── dev-login-openapi.yaml
```

### Source Code (repository root)

```
app/
├── api/
│   └── auth/
│       └── [...nextauth]/
│           └── route.ts                 # Existing NextAuth route passthrough
└── auth/
    ├── error/
    │   └── page.tsx                     # MODIFY: add generic credentials error mapping if needed
    └── signin/
        └── page.tsx                     # MODIFY: conditionally render preview-only dev-login form

app/lib/
└── auth/
    ├── user-service.ts                  # Existing GitHub provisioning logic
    └── dev-login.ts                     # NEW: env gating, input validation, user/account provisioning

lib/
└── auth.ts                              # MODIFY: add Credentials provider and provider-aware callbacks

tests/
├── unit/
│   └── auth/
│       └── [new helper tests]           # NEW: env predicate and validation tests
├── unit/components/
│   └── [new sign-in page tests]         # NEW: enabled/disabled/error rendering
├── integration/
│   └── auth/
│       └── [new auth integration tests] # NEW: success/failure/provisioning behavior
└── e2e/
    └── auth/
        └── [new preview-login spec]     # OPTIONAL: single browser flow for redirect proof
```

**Structure Decision**: Keep auth configuration in [`lib/auth.ts`](/home/runner/work/ai-board/ai-board/target/lib/auth.ts), add a focused helper under `app/lib/auth/` for preview gating and provisioning, and extend the existing App Router sign-in page rather than introducing a new route or standalone API.

## Design Decisions

### D1: Preview-Only Gating

Enable dev login only when all of the following are true:
- `process.env.VERCEL_ENV === "preview"`
- `process.env.DEV_LOGIN_ENABLED === "true"`
- `process.env.DEV_LOGIN_SECRET` is non-empty

This keeps production excluded by construction and avoids exposing the form in local or production environments unless explicitly configured in preview.

### D2: Credentials Provider Placement

Add a `Credentials` provider to [`lib/auth.ts`](/home/runner/work/ai-board/ai-board/target/lib/auth.ts) next to GitHub. The provider `authorize()` flow will delegate to a dedicated dev-login helper that:
- validates the feature is enabled
- validates email format with Zod
- compares the submitted shared secret
- creates or reuses the corresponding `User`
- returns a normal NextAuth user payload with the database `id`

### D3: User Provisioning Model

Keep GitHub provisioning logic unchanged and add a separate provisioning path for credentials sign-ins:
- Existing user by email: reuse the existing `User.id`
- First-time dev-login user: create `User.id` with `crypto.randomUUID()`
- Successful credentials login: upsert an `Account` row using `provider: "credentials"` and normalized email as `providerAccountId`

Using a UUID for new credentials-created users avoids collision with existing GitHub numeric IDs while preserving the stable-email lookup required by the spec.

### D4: Failure UX

Submit the credentials form through a server action in [`app/auth/signin/page.tsx`](/home/runner/work/ai-board/ai-board/target/app/auth/signin/page.tsx). On `AuthError` or rejected credentials, redirect back to `/auth/signin?error=dev-login` and render a generic inline message such as “Sign-in failed. Check your email and shared secret.” No secret value or comparison details should be exposed in the page or logs.

### D5: Existing Auth Behavior Preservation

When dev login is unavailable:
- do not render the credentials form
- keep the GitHub button and callback behavior unchanged
- do not register usable credentials access in practice because both the page and the provider helper remain gated

When dev login is available, GitHub OAuth remains visible and unchanged unless the product owner later requests a preview-specific reduction of providers.

## Testing Strategy

### User Story 1: Sign In to a Preview Deployment

- Unit: env predicate and credentials payload validation helpers
- Component: sign-in page renders the dev-login form when preview gating is enabled
- Integration: valid credentials create or reuse the `User` record, return a session-capable user payload, and preserve existing access
- E2E: one browser test for successful submission and redirect to `/projects` in a preview-configured runtime

### User Story 2: Preserve Existing Sign-In Behavior When Disabled

- Unit: env predicate returns disabled for production and non-preview environments
- Component: sign-in page hides the dev-login form and shows only the standard GitHub action
- Integration: credentials auth path rejects requests when preview gating is disabled, even if credentials are submitted directly

### User Story 3: Reject Invalid Dev Login Attempts Safely

- Unit: invalid email and secret mismatch handling
- Component: generic sign-in failure message renders without exposing the secret
- Integration: invalid credentials do not create a `User`, `Account`, or authenticated session

**Critical test rules applied**:
- API/auth logic uses Vitest integration tests, not Playwright
- E2E stays minimal because only browser form/redirect behavior truly needs it
- Existing auth test helpers and worker-isolation utilities should be reused instead of creating parallel fixtures

## Phase Outputs

### Phase 0: Research

- Resolve gating approach for preview-only exposure
- Resolve provisioning strategy for first-time and existing users
- Resolve test layer split because current auth tests are mostly persistence-oriented

### Phase 1: Design

- `research.md`: final decisions and rationale
- `data-model.md`: `User`, `Account`, `Session`, and dev-login configuration relationships
- `contracts/dev-login-openapi.yaml`: credential callback contract and relevant auth responses
- `quickstart.md`: implementation sequence and verification steps
- Agent context update via `.claude-plugin/scripts/bash/update-agent-context.sh claude`

## Complexity Tracking

No constitution violations. No complexity justifications required.
