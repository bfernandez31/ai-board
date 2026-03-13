# Implementation Plan: BYOK - Bring Your Own API Key

**Branch**: `AIB-283-byok-bring-your` | **Date**: 2026-03-13 | **Spec**: `specs/AIB-283-byok-bring-your/spec.md`
**Input**: Feature specification from `/specs/AIB-283-byok-bring-your/spec.md`

## Summary

Add project-scoped BYOK credential management for Anthropic and OpenAI in project settings. Owners can save, validate, rotate, and delete encrypted provider keys; members can only see high-level status. Workflow launches are gated before dispatch, required credentials are snapshotted per job so in-flight runs remain stable, and workflows retrieve decrypted provider credentials only through workflow-token-authenticated server endpoints.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, PostgreSQL 14+, Zod, shadcn/ui, lucide-react  
**Storage**: PostgreSQL via Prisma for credential metadata and encrypted secret blobs; environment-managed encryption key for server-side decrypt/encrypt  
**Testing**: Vitest unit, component, and backend integration tests; no Playwright coverage required for initial rollout  
**Target Platform**: Web application on Vercel plus GitHub Actions workflow runners  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: Settings reads under 300ms server time; validation feedback under 5s; BYOK gating before workflow dispatch with no queued job when required credentials are unusable  
**Constraints**: Secrets never returned after save, never logged, owner-only mutation access, member read access limited to status, no fallback to platform-managed credentials for gated workflows, in-progress jobs must keep launch-time credential snapshot  
**Scale/Scope**: 2 providers, 1 settings surface, 4 owner CRUD/validation endpoints, 1 workflow credential retrieval endpoint, transition gating in existing ticket launch flow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | All touched areas are TypeScript; new credential/domain types will be explicit and shared across API/UI layers |
| II. Component-Driven Architecture | PASS | Project settings extends existing card-based pattern under `components/settings/`; API routes stay under `app/api/projects/[projectId]/...` |
| III. Test-Driven Development | PASS | Testing plan uses unit tests for crypto and requirement mapping, component tests for settings UI states, backend integration tests for API and transition gating |
| IV. Security-First Design | PASS | Zod validation, encrypted-at-rest secrets, workflow-token-protected retrieval, sanitized error mapping, no secret echoing in responses/logs |
| V. Database Integrity | PASS | Prisma migration required for credential tables/enums; launch snapshotting of job credentials uses transactions |
| V. Specification Clarification Guardrails | PASS | Spec already records all auto-resolved decisions and trade-offs |
| VI. AI-First Development Model | PASS | All planning artifacts remain under `specs/AIB-283-byok-bring-your/`; no root-level docs are introduced |

**Gate Result**: ALL PASS. Proceed to research and design.

## Project Structure

### Documentation (this feature)

```text
specs/AIB-283-byok-bring-your/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── byok-api.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── api/projects/[projectId]/
│   ├── ai-credentials/
│   │   ├── route.ts
│   │   ├── [provider]/
│   │   │   ├── route.ts
│   │   │   └── validate/route.ts
│   ├── jobs/[jobId]/
│   │   └── provider-credentials/route.ts
│   └── tickets/[id]/transition/route.ts
├── lib/
│   ├── schemas/
│   │   └── ai-credentials.ts
│   ├── security/
│   │   └── project-ai-credentials.ts
│   ├── services/
│   │   ├── ai-credential-service.ts
│   │   ├── ai-provider-validation.ts
│   │   └── workflow-provider-requirements.ts
│   └── types/
│       └── ai-credentials.ts
└── projects/[projectId]/settings/page.tsx

components/
└── settings/
    ├── ai-credentials-card.tsx
    └── ai-provider-status-row.tsx

lib/
├── db/
│   └── projects.ts
└── workflows/
    └── transition.ts

prisma/
├── schema.prisma
└── migrations/

.github/
├── scripts/run-agent.sh
└── workflows/
    ├── speckit.yml
    ├── quick-impl.yml
    ├── verify.yml
    ├── iterate.yml
    ├── cleanup.yml
    └── ai-board-assist.yml

tests/
├── unit/
│   ├── ai-provider-requirements.test.ts
│   └── project-ai-credentials.test.ts
├── unit/components/
│   └── ai-credentials-card.test.tsx
└── integration/
    ├── projects/
    │   └── ai-credentials.test.ts
    └── tickets/
        └── transition-byok.test.ts
```

**Structure Decision**: Reuse the existing Next.js/Prisma layout. Project settings continues the current card-based settings page pattern, while workflow gating extends the existing transition path instead of adding a parallel launch system.

## Complexity Tracking

No constitution violations or extra complexity justifications required.

## Phase 0: Research Summary

All open design questions were resolved. See `research.md` for full rationale.

Key decisions:
1. Store project credentials as decryptable encrypted blobs, not hashes, because workflows must use plaintext secrets after launch gating.
2. Snapshot required provider credentials per job at dispatch time so rotation/deletion affects only future jobs.
3. Use a workflow-token-authenticated endpoint for job-scoped credential retrieval instead of dispatch inputs or GitHub secrets, which would leak secrets into workflow metadata.
4. Extend agent execution to accept `ANTHROPIC_API_KEY` for Claude jobs and `OPENAI_API_KEY` for Codex jobs, while preserving existing global secrets for non-BYOK paths during rollout.
5. Model provider requirements centrally from workflow command + effective agent so current single-provider flows work now and multi-provider checks remain extensible.

## Phase 1: Design

### Data Model

See `data-model.md` for entity definitions.

- `ProjectAiCredential`: project-scoped encrypted provider credential plus masked suffix, validation status, and ownership metadata
- `JobAiCredentialSnapshot`: immutable encrypted snapshot of the provider credential captured for a specific job launch
- `WorkflowProviderRequirement`: code-level mapping from command/agent to required providers used during preflight gating

### API Contracts

See `contracts/byok-api.yaml`.

- `GET /api/projects/{projectId}/ai-credentials`: list provider statuses, with owner/member-specific response shaping
- `PUT /api/projects/{projectId}/ai-credentials/{provider}`: save or replace a provider key and persist masked metadata
- `POST /api/projects/{projectId}/ai-credentials/{provider}/validate`: re-validate the currently stored key with safe provider feedback
- `DELETE /api/projects/{projectId}/ai-credentials/{provider}`: remove stored key and clear future eligibility
- `GET /api/projects/{projectId}/jobs/{jobId}/provider-credentials`: workflow-only endpoint for retrieving launch-time credential snapshots
- `POST /api/projects/{projectId}/tickets/{id}/transition`: existing route extended with BYOK gating error contract

### Implementation Task Outline

1. Add Prisma enums/models for provider credentials and job snapshots, then regenerate the Prisma client.
2. Implement server-side encryption helpers, provider validation adapters, and requirement-resolution service.
3. Build owner/member BYOK settings APIs and extend project settings UI with new credential cards.
4. Gate workflow launches in `lib/workflows/transition.ts`, create job credential snapshots, and expose workflow-only credential retrieval.
5. Update GitHub workflow env wiring and `.github/scripts/run-agent.sh` so BYOK secrets are consumed from job-scoped runtime retrieval instead of repository secrets.
6. Add unit/component/integration coverage for crypto, API authorization, validation, and transition blocking.

## Phase 2: Post-Design Constitution Re-check

| Principle | Status | Verification |
|-----------|--------|--------------|
| I. TypeScript-First Development | PASS | `data-model.md` and contract shapes define explicit enums/interfaces for provider states, API payloads, and snapshot records |
| II. Component-Driven Architecture | PASS | UI stays within `components/settings/` and project settings page composition; backend logic is isolated in service modules |
| III. Test-Driven Development | PASS | `quickstart.md` assigns unit/component/integration tests using the repo’s Testing Trophy rules; no E2E added without browser-only need |
| IV. Security-First Design | PASS | Post-design plan uses encrypted storage, workflow-only secret retrieval, Zod validation, sanitized provider errors, and no secret-bearing responses |
| V. Database Integrity | PASS | Design requires Prisma migrations plus transactional job snapshot creation before workflow dispatch |
| V. Specification Clarification Guardrails | PASS | Design preserves conservative security choices from the spec rather than weakening them |
| VI. AI-First Development Model | PASS | Generated docs remain scoped to `specs/AIB-283-byok-bring-your/` |

**Post-Design Gate Result**: ALL PASS.

## Generated Artifacts

| Artifact | Path |
|----------|------|
| Research | `specs/AIB-283-byok-bring-your/research.md` |
| Data Model | `specs/AIB-283-byok-bring-your/data-model.md` |
| API Contract | `specs/AIB-283-byok-bring-your/contracts/byok-api.yaml` |
| Quickstart | `specs/AIB-283-byok-bring-your/quickstart.md` |
