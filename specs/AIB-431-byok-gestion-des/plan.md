# Implementation Plan: BYOK - gestion des cles API utilisateur pour les agents AI

**Branch**: `AIB-431-byok-gestion-des` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-431-byok-gestion-des/spec.md`

## Execution Flow (/plan command scope)
```text
1. Load feature spec from Input path
   -> PASS: Spec loaded from specs/AIB-431-byok-gestion-des/spec.md
2. Fill Technical Context
   -> PASS: Stack, auth, storage, and workflow constraints resolved from repo context
3. Fill Constitution Check section
   -> PASS: Gates defined from .ai-board/memory/constitution.md
4. Evaluate Constitution Check section
   -> PASS: No blocking violations before research
5. Execute Phase 0 -> research.md
   -> PASS: Storage, validation, workflow auth, and testing decisions documented
6. Execute Phase 1 -> data-model.md, contracts/, quickstart.md
   -> PASS: Design artifacts generated
7. Update agent context
   -> PENDING UNTIL SCRIPT RUN: update-agent-context.sh claude
8. Re-evaluate Constitution Check section
   -> PASS: Design remains compliant post-design
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The `/plan` workflow stops after design artifacts and task-planning guidance. It does not implement code or generate `tasks.md`.

## Summary
Add project-owner-scoped BYOK credential management for Anthropic so each user can maintain exactly one active credential per provider, workflows always resolve the project owner's credential through a workflow-only endpoint, and launches fail closed with actionable remediation when the owner credential is unavailable or invalid. The implementation reuses the existing settings/tokens UI and API patterns, introduces encrypted-at-rest user AI credentials with soft-delete auditability, and adds workflow-facing retrieval contracts that never place secrets in browser-visible payloads.

## Technical Context
**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 App Router, React 18, Prisma 6.x, NextAuth.js 5 beta, TanStack Query v5.95.2, Zod 4, shadcn/ui, lucide-react  
**Storage**: PostgreSQL 14+ via Prisma; new encrypted credential records stored in app DB with environment-managed encryption key  
**Testing**: Vitest unit/component/integration tests, Playwright E2E for browser-required flows  
**Target Platform**: Web application on Vercel with GitHub Actions workflows calling server APIs  
**Project Type**: Web application (Next.js App Router monorepo)  
**Performance Goals**: Client-side format validation under 100ms per change; credential save/verification p95 under 3s; workflow credential retrieval p95 under 500ms; owner credential changes affect the next launch immediately  
**Constraints**: No shared fallback credential; one active credential per provider per user; secrets never re-displayed after save; workflow-only retrieval via `WORKFLOW_API_TOKEN`; owner credential governs all project workflows; Tailwind classes must stay static; use semantic color tokens only  
**Scale/Scope**: Initial launch limited to Anthropic with two credential types; one active credential row per `(userId, provider)`; all workflow commands that invoke AI must gate on owner credential eligibility across owner/member launches

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
- [x] New server utilities, schemas, hooks, and route handlers remain in TypeScript strict mode
- [x] Prisma model additions will map to explicit TS response/request types
- [x] No `any` required for credential adapters or workflow response contracts

### II. Component-Driven Architecture
- [x] User settings UI reuses existing settings page patterns and shadcn/ui cards/dialogs
- [x] Server page shells stay in `app/`; interactive forms/lists live in feature components
- [x] Shared credential logic is isolated in `lib/ai-credentials/*` and `lib/hooks/mutations/*`

### III. Test-Driven Development (NON-NEGOTIABLE)
- [x] User Story 1 primarily covered by integration tests plus component tests for interactive form behavior
- [x] User Story 2 primarily covered by integration tests for API/auth/db workflow gating
- [x] User Story 3 covered by integration tests for replace/delete semantics and a minimal E2E smoke path for browser-only flows
- [x] No story relies on Playwright unless the browser interaction itself is the behavior under test

### IV. Security-First Design
- [x] Client and server validation use Zod-backed schemas and provider-specific format checks
- [x] Secrets are encrypted at rest and never returned from standard user APIs after submission
- [x] Workflow retrieval is isolated to workflow Bearer-token auth and fails closed on any lookup/verification issue
- [x] Logs and user-facing responses expose only masked previews and non-sensitive error codes/messages

### V. Database Integrity
- [x] Schema changes will be applied via Prisma migration and client regeneration
- [x] Unique constraint on `(userId, provider)` enforces one active credential per provider
- [x] Delete behavior preserves auditability via soft-delete metadata while rendering the secret unusable
- [x] Multi-step save/replace/delete flows use Prisma transactions where credential state and verification metadata change together

**Initial Assessment**: PASS

## Project Structure

### Documentation (this feature)
```text
specs/AIB-431-byok-gestion-des/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── user-ai-credentials.yaml
│   └── workflow-owner-credential.yaml
└── tasks.md
```

### Source Code (repository root)
```text
app/
├── settings/
│   └── ai-credentials/
│       └── page.tsx                              # New user-level BYOK settings page
├── api/
│   ├── settings/
│   │   └── ai-credentials/
│   │       ├── route.ts                         # GET list of user credentials
│   │       └── [provider]/
│   │           └── route.ts                     # PUT upsert and DELETE provider credential
│   └── internal/
│       └── workflows/
│           └── projects/
│               └── [projectId]/
│                   └── providers/
│                       └── [provider]/
│                           └── credential/
│                               └── route.ts     # Workflow-only owner credential retrieval

components/
├── ai-credentials/
│   ├── credential-settings-card.tsx             # Primary management card
│   ├── save-credential-dialog.tsx               # Create/replace flow
│   ├── credential-list.tsx                      # Masked list/readiness state
│   └── delete-credential-dialog.tsx             # Delete confirmation
├── settings/
│   └── ...                                      # Existing settings card patterns reused
└── auth/
    └── user-menu.tsx                            # Add entry point to new settings page

lib/
├── ai-credentials/
│   ├── crypto.ts                                # Encrypt/decrypt helpers
│   ├── providers/
│   │   └── anthropic.ts                         # Format + remote verification adapter
│   ├── service.ts                               # Save/list/delete business logic
│   ├── workflow.ts                              # Owner resolution + workflow payload mapping
│   └── types.ts                                 # Shared DTOs and enums
├── db/
│   └── ai-credentials.ts                        # Prisma access layer
├── hooks/
│   └── mutations/
│       └── useAiCredentials.ts                  # React Query hooks
└── validations/
    └── ai-credentials.ts                        # Shared Zod schemas

prisma/
└── schema.prisma                                # New credential model + enums

tests/
├── integration/
│   ├── ai-credentials/
│   │   ├── settings-api.test.ts
│   │   └── workflow-owner-credential.test.ts
├── unit/
│   ├── ai-credentials/
│   │   └── crypto.test.ts
│   └── components/
│       └── ai-credential-settings-card.test.tsx
└── e2e/
    └── ai-credentials.spec.ts
```

**Structure Decision**: Keep the existing Next.js monorepo layout. Add a user settings surface under `app/settings/ai-credentials`, browser APIs under `app/api/settings`, and a workflow-only internal endpoint under `app/api/internal/workflows`. Shared domain logic lives under `lib/ai-credentials` so user flows and workflow retrieval use the same provider and masking rules.

## Phase 0: Outline & Research

### Research Inputs
There were no unresolved `NEEDS CLARIFICATION` placeholders in the feature spec, but the implementation still required explicit decisions for:
1. Secret-at-rest protection compatible with Prisma/PostgreSQL and the constitution
2. Anthropic credential validation flow for API key and OAuth-style credentials
3. Workflow-only secure retrieval using existing bearer-token workflow auth
4. UI/test layering that fits current settings and token-management patterns

### Research Outcomes
1. **Secret storage**: Introduce a `UserAiCredential` model with encrypted secret material, per-record IV/auth tag, masked preview, readiness metadata, and soft-delete timestamps; on delete, clear encrypted secret fields while preserving non-sensitive audit metadata.
2. **Validation strategy**: Use shared Zod schemas plus provider adapters. Client performs synchronous format checks; server performs authoritative verification before status becomes `READY`.
3. **Workflow retrieval**: Add a dedicated internal POST endpoint authenticated only by `WORKFLOW_API_TOKEN`; it resolves the project owner, loads the active provider credential, maps credential type to workflow auth mode, and returns fail-closed error codes when unusable.
4. **UI strategy**: Reuse the existing tokens/settings card pattern with a dedicated `ai-credentials` query-key namespace and integration-heavy testing.

**Output**: [research.md](./research.md)

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Data model extraction** -> `data-model.md`
   - Add `UserAiCredential` as the persistent secret-bearing entity
   - Add enums for provider, credential type, and readiness status
   - Model secure workflow retrieval as a transient service object, not a persisted table

2. **Interface contracts** -> `contracts/`
   - `user-ai-credentials.yaml`: user settings APIs for list/upsert/delete
   - `workflow-owner-credential.yaml`: workflow-only owner credential retrieval contract

3. **Quickstart scenarios** -> `quickstart.md`
   - Save valid Anthropic credential
   - Block workflow when owner credential missing/invalid
   - Replace/delete credential and observe next-launch behavior

4. **Agent context update**
   - Run `.claude-plugin/scripts/bash/update-agent-context.sh claude`
   - Plan introduces encrypted secret storage and new internal workflow credential APIs; no new third-party dependency is required in the current design

5. **Post-design constitution re-check**
   - Confirm encryption, soft-delete handling, test mapping, and UI architecture remain compliant

**Output**: [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), [user-ai-credentials.yaml](./contracts/user-ai-credentials.yaml), [workflow-owner-credential.yaml](./contracts/workflow-owner-credential.yaml)

## Testing Strategy

### User Story 1 - Configurer une credentiel Anthropic utilisable
- **Integration**: `tests/integration/ai-credentials/settings-api.test.ts`
  Validate create/list/update server behavior, masking rules, server-side verification outcomes, and replacement semantics.
- **Component**: `tests/unit/components/ai-credential-settings-card.test.tsx`
  Validate provider/type switching, disabled submit while invalid, status rendering, and actionable inline errors.
- **E2E**: `tests/e2e/ai-credentials.spec.ts`
  Minimal browser smoke path for save flow and masked post-save display.

### User Story 2 - Lancer un workflow avec la credentiel du owner
- **Integration**: `tests/integration/ai-credentials/workflow-owner-credential.test.ts`
  Validate owner-vs-member behavior, workflow bearer-token auth, missing/invalid owner credential blocking, and provider-specific auth-mode mapping.
- **Integration**: extend launch/transition route tests where workflows are dispatched so blocked launches surface the new remediation message before AI execution starts.
- **E2E**: Only add browser coverage if an existing launch UI must render the remediation banner; otherwise keep this story at integration level.

### User Story 3 - Gerer le cycle de vie sans re-exposer le secret
- **Integration**: extend `settings-api.test.ts` for replace/delete/readiness transitions and immediate next-launch effects.
- **Component**: extend `ai-credential-settings-card.test.tsx` for masked read-only rendering and delete confirmation states.
- **E2E**: cover replace/delete browser flow only once to ensure dialogs and masked state are wired correctly.

### Supporting Tests
- **Unit**: `tests/unit/ai-credentials/crypto.test.ts` for encrypt/decrypt, invalid key handling, and secret shredding behavior.
- **Search existing tests first**: extend token/settings/workflow auth tests when behavior overlaps instead of duplicating setup scaffolding.

## Phase 2: Task Planning Approach
*This section describes what `/tasks` will do; it is not executed here.*

**Task Generation Strategy**:
1. Generate Prisma/schema and validation tasks first because all API and UI work depends on them
2. Add integration tests before route implementation for settings APIs and workflow retrieval
3. Add component tests before implementing the interactive settings card/dialog behavior
4. Add minimal E2E tasks last for true browser-only confidence
5. Finish with migration/client-generation, type-check, lint, and targeted test runs

**Expected Task Groups**:
1. Schema and migration tasks for `UserAiCredential` and related enums
2. Secret crypto/provider validation utility tasks
3. Settings API contract/integration test tasks
4. Workflow retrieval API contract/integration test tasks
5. Settings page/component implementation tasks
6. Launch-blocking message propagation tasks
7. Verification tasks (`bunx prisma generate`, `bun run type-check`, `bun run lint`, targeted tests)

**Ordering Constraints**:
- Prisma model and schemas before DB/service code
- DB/service code before route handlers
- Route handlers before React Query hooks/UI integration
- Integration/component tests before E2E

## Phase 3+: Future Implementation
**Phase 3**: `/tasks` command generates `tasks.md`  
**Phase 4**: Implement schema, APIs, UI, and workflow integration  
**Phase 5**: Validate via tests and quickstart scenarios

## Complexity Tracking
| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

**Post-Design Assessment**: PASS
