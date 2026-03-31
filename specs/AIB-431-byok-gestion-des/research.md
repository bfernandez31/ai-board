# Research: BYOK - gestion des cles API utilisateur pour les agents AI

**Feature**: AIB-431-byok-gestion-des  
**Date**: 2026-03-31  
**Status**: Complete

## Overview
Research focused on four design questions that were not spelled out by the feature spec but are required for safe implementation: how to store secrets at rest, how to validate Anthropic credentials, how workflows securely retrieve the project owner's credential, and how the settings UI/tests should align with existing repo patterns.

## Decisions

### 1. Secret Storage Model
**Decision**: Store one provider-scoped `UserAiCredential` row per user, encrypt the secret at rest with an application-managed symmetric key, and preserve auditability with soft-delete metadata plus secret shredding on delete.

**Rationale**:
- The feature requires secrets to be available later for workflow execution, so token-style hashing is insufficient.
- Existing token management already proves the pattern of showing only a preview after save, but those tokens are never decrypted again; BYOK needs reversible storage.
- The constitution requires strong secret protection and database integrity. Encryption-at-rest with explicit metadata satisfies both while keeping implementation inside the existing app/database boundary.
- Soft-delete metadata satisfies the constitution's auditability requirement; clearing ciphertext fields on delete prevents continued secret recovery after user removal.

**Alternatives Considered**:
- Hash-only storage: rejected because workflows need the original secret later.
- Reusing a plain environment variable or shared platform key: rejected by FR-015 and the mandatory BYOK model.
- External secret manager for the initial release: rejected as unnecessary scope expansion relative to the current app architecture.

**Implementation References**:
- `app/api/tokens/route.ts`
- `lib/db/tokens.ts`
- `.ai-board/memory/constitution.md`

---

### 2. Anthropic Credential Validation
**Decision**: Use a two-stage validation flow: shared Zod/adapter format validation in the browser and server, followed by provider-backed verification before status becomes `READY`.

**Rationale**:
- FR-004 requires format validation while the user types; this is best handled locally with static provider/type-specific rules.
- FR-005 requires authoritative server-side usability verification before activation; only the server can safely call provider verification endpoints without exposing secrets.
- A provider adapter keeps the provider-specific auth mapping isolated and makes later providers additive rather than invasive.

**Alternatives Considered**:
- Client-only validation: rejected because it cannot prove the credential is accepted by the provider.
- Server-only validation on submit: rejected because it misses the immediate UX feedback required by FR-004.
- A generic untyped provider layer now: rejected because only Anthropic is in scope; a narrower adapter surface is safer.

**Implementation References**:
- `specs/specifications/technical/api/schemas.md`
- `app/api/tokens/route.ts`
- `package.json` (`zod`, no existing provider SDK dependency)

---

### 3. Workflow-Only Owner Credential Retrieval
**Decision**: Add a dedicated internal POST endpoint under `/api/internal/workflows/projects/:projectId/providers/:provider/credential` authenticated solely by `WORKFLOW_API_TOKEN`, resolving the project owner and returning only the active owner credential payload needed by the workflow.

**Rationale**:
- Existing workflow endpoints already use a shared bearer token pattern, so this fits the current security model.
- FR-010, FR-011, and FR-017 require owner-only credential resolution through a workflow-only path, never via browser-visible launch payloads.
- A dedicated endpoint keeps secrets off standard project/member endpoints and allows purpose-built fail-closed error codes for launch gating.
- Lookup at launch time ensures replacement/deletion affects the next workflow immediately, matching FR-008 and the queue-related edge case.

**Alternatives Considered**:
- Embedding owner secrets in the workflow dispatch payload: rejected because it exposes secrets outside the retrieval boundary.
- Letting the launching member's session resolve the secret directly: rejected because authorization must always follow project ownership.
- Reusing a generic ticket/jobs endpoint: rejected because it would mix secret-bearing responses with normal UI/workflow concerns.

**Implementation References**:
- `app/lib/auth/workflow-auth.ts`
- `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`
- `specs/specifications/technical/api/endpoints.md`

---

### 4. User Settings UI Pattern
**Decision**: Reuse the existing user settings and personal token-management pattern: a dedicated settings page, shadcn/ui cards/dialogs, React Query hooks for list/mutate/invalidate, and masked list rendering after save.

**Rationale**:
- The existing `/settings/tokens` flow already matches the lifecycle shape of this feature: create, display metadata, and revoke/delete.
- Settings cards in the repo already use stable visual conventions (`Card`, `CardHeader`, `CardContent`, `aurora-bg-subtle`) and fit the feature without introducing a new UI system.
- Query-key and mutation patterns are already established, minimizing incidental complexity.

**Alternatives Considered**:
- Embedding BYOK controls into project settings: rejected because credentials are user-owned, not project-owned.
- Building a custom settings shell: rejected because the repo already has a working settings pattern.
- Heavy E2E coverage: rejected because most behavior is API/auth/database logic better covered by integration tests.

**Implementation References**:
- `app/settings/tokens/page.tsx`
- `components/settings/clarification-policy-card.tsx`
- `lib/hooks/mutations/useTokens.ts`
- `tests/integration/tokens/api.test.ts`
- `tests/e2e/tokens.spec.ts`

---

### 5. Test Layer Assignment
**Decision**: Make integration tests the primary confidence layer, add focused component tests for the interactive settings UI, and keep Playwright coverage to a thin browser smoke path.

**Rationale**:
- The repo constitution and AGENTS guidance both prioritize integration tests for API/database behavior.
- User Story 2 is almost entirely auth/database/workflow logic and does not require a browser by default.
- The browser only adds unique value for modal/form state, masked rendering, and top-level navigation from user settings.

**Alternatives Considered**:
- E2E-first coverage: rejected due to runtime cost and poorer failure isolation.
- Unit-only coverage of services: rejected because the critical risks cross API/auth/Prisma boundaries.

## Resulting Design Constraints
- Secret-bearing APIs must never be reachable via session-authenticated browser requests after initial save.
- Delete semantics must preserve audit metadata while rendering the secret irrecoverable.
- The next workflow launch must always observe the latest saved credential state.
- Error responses must be actionable but non-sensitive, using masked previews and reason codes instead of secret details.
