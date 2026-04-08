# Implementation Plan: Project Setup Page and Hybrid Initialization Workflow

**Branch**: `AIB-573-copy-of-project` | **Date**: 2026-04-08 | **Spec**: [/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/spec.md](/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/spec.md)
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/spec.md`

## Summary

Imported repositories that do not yet have synced AI Board configuration will enter an owner-only setup flow instead of falling into a dead-end redirect. The implementation adds a dedicated project setup route, a project-scoped onboarding job model and API surface, a GitHub Actions onboarding workflow that combines deterministic repository detection with agent-driven guidance generation, and settings affordances for reviewing or adjusting the generated artifacts after initialization.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict), Node.js 22.20.0  
**Primary Dependencies**: Next.js 16.2.1 App Router, React 18.3.1, Prisma 6.19.2, Zod 4.3.6, TanStack Query 5.95.2, NextAuth 5 beta, Octokit 22.0.1, Bun 1.3.1  
**Storage**: PostgreSQL 14+ via Prisma; repository-backed onboarding artifacts in the imported GitHub repository default branch  
**Testing**: Vitest unit/integration, React Testing Library component tests, selective Playwright E2E only for end-to-end browser-only setup navigation  
**Target Platform**: Next.js full-stack web app on Node/Vercel plus GitHub Actions workflows running on Ubuntu  
**Project Type**: Web application  
**Performance Goals**: Setup page first load stays within normal project page budget; onboarding dispatch returns within 1 request cycle; polling remains on the existing 2s job cadence; successful onboarding should satisfy the spec target of 95% within 3 minutes  
**Constraints**: Owner-only setup initiation, duplicate active setup jobs forbidden per project, no destructive overwrite of an existing primary agent instruction file, atomic repository commit on default branch, callback failures must not leave orphaned RUNNING state, generated files must use existing agent/runtime conventions, all UI must use shadcn/Tailwind semantic tokens  
**Scale/Scope**: One authoritative onboarding workflow per imported project, two supported agents (`CLAUDE`, `CODEX`), repo detection across JS/TS, Python, Rust, Go, Java/Kotlin, Ruby, PHP, and post-onboarding settings review for a small fixed artifact set

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gate

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | Planned changes stay in strict TypeScript across routes, hooks, components, workflow payload types, and Prisma schema typing. |
| II. Component-Driven Architecture | PASS | UI work stays under `/components/projects` and `/components/settings`; server logic stays in App Router routes and `/lib` helpers. |
| III. Test-Driven Development | PASS | Existing import, config sync, credential, project settings, and job polling test suites can be extended; new setup page tests are required only where no existing file owns the domain. |
| IV. Security-First Design | PASS | Owner-only setup access, Zod input validation, provider-aware credential readiness checks, workflow token callbacks, and no secret material returned to browser clients. |
| V. Database Integrity | PASS | New onboarding job persistence requires Prisma migration and transactional dispatch/update logic to avoid orphaned active states. |
| V. Specification Clarification Guardrails | PASS | The source spec already includes auto-resolved decisions and the plan keeps the conservative duplicate-dispatch and preservation posture. |

### Post-Design Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | Design introduces typed DTOs for setup state, workflow payloads, artifact summaries, and Prisma-backed onboarding status without `any`. |
| II. Component-Driven Architecture | PASS | Setup UI is isolated to a project setup route and settings cards; shared utilities stay single-responsibility in `/lib/onboarding` and `/lib/github`. |
| III. Test-Driven Development | PASS | Testing strategy extends existing import/config-sync/settings/credential suites first, then adds targeted setup page and setup API coverage. |
| IV. Security-First Design | PASS | Design enforces owner-only initiation, explicit credential readiness gating, workflow-authenticated callbacks, and actionable but non-secret error responses. |
| V. Database Integrity | PASS | `ProjectSetupJob` owns the authoritative lifecycle and is updated transactionally around dispatch, callback, and config sync completion. |
| V. Specification Clarification Guardrails | PASS | Conservative guards remain intact after design: no duplicate runs, no overwriting primary instructions, no success without commit plus config sync. |

## Project Structure

### Documentation (this feature)

```
/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   └── project-setup-api.yaml
├── workflows/
│   ├── hybrid-onboarding-workflow.md
│   ├── onboarding-command.md
│   └── setup-status-callback.md
└── tasks.md
```

### Source Code (repository root)

```
/home/runner/work/ai-board/ai-board/target/app/
├── api/
│   ├── projects/
│   │   ├── import/route.ts
│   │   └── [projectId]/
│   │       ├── route.ts
│   │       ├── config/sync/route.ts
│   │       ├── jobs/status/route.ts
│   │       ├── settings/            # new onboarding review endpoints
│   │       └── setup/               # new setup state + dispatch endpoints
│   └── internal/
│       └── credentials/route.ts
├── lib/
│   ├── query-keys.ts
│   ├── schemas/
│   │   ├── agent.ts
│   │   └── job-polling.ts
│   └── workflows/
│       ├── dispatch-ai-board.ts
│       └── test-mode.ts
├── projects/
│   └── [projectId]/
│       ├── layout.tsx
│       ├── board/page.tsx
│       ├── settings/page.tsx
│       └── setup/page.tsx           # new owner-only setup route
/home/runner/work/ai-board/ai-board/target/components/
├── projects/
│   ├── import-project-modal.tsx
│   ├── project-card.tsx
│   └── setup/                       # new setup page client components
└── settings/
    ├── config-card.tsx
    └── onboarding-artifacts-card.tsx  # new settings review surface
/home/runner/work/ai-board/ai-board/target/lib/
├── ai-credentials/
│   └── workflow.ts
├── config-sync.ts
├── db/
│   ├── auth-helpers.ts
│   └── projects.ts
├── github/
│   └── user-client.ts
└── onboarding/                      # new onboarding orchestration and DTO helpers
/home/runner/work/ai-board/ai-board/target/prisma/
├── schema.prisma
└── migrations/                      # required for ProjectSetupJob
/home/runner/work/ai-board/ai-board/target/.github/workflows/
└── project-onboarding.yml           # new hybrid initialization workflow
/home/runner/work/ai-board/ai-board/target/tests/
├── integration/
│   ├── projects/
│   │   ├── import.test.ts
│   │   ├── config-sync.test.ts
│   │   └── settings.test.ts
│   ├── credentials/
│   │   ├── credentials-api.test.ts
│   │   ├── credential-validation.test.ts
│   │   └── workflow-credential.test.ts
│   └── jobs/status.test.ts
├── unit/
│   ├── credential-dispatch-guard.test.ts
│   ├── agent-schema.test.ts
│   └── components/
│       ├── config-card.test.tsx
│       └── projects/import-project-modal.test.tsx
└── e2e/
    └── project-setup-onboarding.spec.ts   # new only if integration coverage cannot fully validate redirect/resume flow
```

**Structure Decision**: Keep the existing Next.js monolith structure. Extend current import, project routing, settings, credential, and workflow patterns rather than adding a separate service. Introduce a small `/home/runner/work/ai-board/ai-board/target/lib/onboarding` module boundary for setup-specific orchestration and DTO logic.

## Complexity Tracking

No constitution violations require justification.

## Phase 0: Research & Decisions

Phase 0 is complete in [/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/research.md](/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/research.md). Key decisions:

1. Add a dedicated `ProjectSetupJob` model instead of reusing ticket `Job` rows.
2. Gate all project entry points through setup-required resolution rather than letting project cards bypass setup.
3. Use deterministic repository detection for `.ai-board/config.yml` generation, then a selected-agent generation phase for governance/instruction artifacts.
4. Persist artifact summaries in the setup job result while treating committed repository files as the source of truth.
5. Extend existing settings/config/credential test suites before creating new test files.

## Phase 1: Design & Contracts

### Data Model

Data modeling output is in [/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/data-model.md](/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/data-model.md).

### API Contracts

External interfaces are specified in [/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/contracts/project-setup-api.yaml](/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/contracts/project-setup-api.yaml).

### Workflow / Agent Artifacts

Internal process design artifacts are documented in:

- [/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/workflows/hybrid-onboarding-workflow.md](/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/workflows/hybrid-onboarding-workflow.md)
- [/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/workflows/onboarding-command.md](/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/workflows/onboarding-command.md)
- [/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/workflows/setup-status-callback.md](/home/runner/work/ai-board/ai-board/target/specs/AIB-573-copy-of-project/workflows/setup-status-callback.md)

## Implementation Plan

### Phase 2.1: Persistence and Routing Foundation

- Add `ProjectSetupJob` and supporting enums/JSON payload fields in `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`.
- Introduce setup-aware project entry resolution in a new `/home/runner/work/ai-board/ai-board/target/lib/onboarding/access.ts` helper used by `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/layout.tsx`, `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/board/page.tsx`, and `/home/runner/work/ai-board/ai-board/target/components/projects/project-card.tsx`.
- Add `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/setup/page.tsx` as the owner-only entrypoint for imported projects that still require initialization.

### Phase 2.2: Setup APIs and Orchestration

- Add `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/route.ts` for initial state and start-dispatch actions.
- Add `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/status/route.ts` for polling and resume.
- Add `/home/runner/work/ai-board/ai-board/target/lib/onboarding/service.ts` for ownership checks, credential readiness lookup, duplicate-active-run prevention, dispatch bookkeeping, and latest-job summary shaping.
- Extend `/home/runner/work/ai-board/ai-board/target/app/api/internal/credentials/route.ts` only if workflow onboarding requires richer provider/readiness payloads than the current secret-resolution contract.

### Phase 2.3: Workflow Execution and Callback Path

- Add `/home/runner/work/ai-board/ai-board/target/.github/workflows/project-onboarding.yml` using the existing double-checkout and workflow-token callback pattern from `speckit.yml`, `verify.yml`, and `ai-board-assist.yml`.
- Add onboarding command assets under `/home/runner/work/ai-board/ai-board/target/.claude/commands/` and shared workflow scripts under `/home/runner/work/ai-board/ai-board/target/.github/scripts/` or `/home/runner/work/ai-board/ai-board/target/.claude-plugin/scripts/bash/` as implementation dictates.
- Add `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/status/route.ts` callback handling or a dedicated `/status` mutation endpoint from the contract to record RUNNING, COMPLETED, and FAILED transitions plus artifact summaries, commit SHA, and sync result.
- Reuse `/home/runner/work/ai-board/ai-board/target/lib/config-sync.ts` after commit completion to populate `Project.config` and `configSyncedAt` from the newly generated `.ai-board/config.yml`.

### Phase 2.4: Setup UI and Settings Review

- Add setup page components under `/home/runner/work/ai-board/ai-board/target/components/projects/setup/` for agent selection, credential readiness banners, active job progress, elapsed time, success summary, and retry affordances.
- Extend `/home/runner/work/ai-board/ai-board/target/app/lib/query-keys.ts` with setup and onboarding artifact query keys.
- Extend `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/settings/page.tsx` and `/home/runner/work/ai-board/ai-board/target/components/settings/config-card.tsx` with an onboarding artifacts review card backed by new artifact read/update endpoints.

## Testing Strategy

Use the constitution decision tree and extend existing tests first.

### Existing test files to extend

- `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/import.test.ts`: add missing-config import redirect assertions and duplicate import/setup resume behavior.
- `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/config-sync.test.ts`: add post-onboarding sync and stale-config bypass assertions.
- `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/settings.test.ts`: add onboarding artifact review/update API coverage.
- `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/credentials-api.test.ts`: add owner credential readiness preconditions surfaced to setup state.
- `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/workflow-credential.test.ts`: add onboarding workflow secret resolution scenarios for `CLAUDE` and `CODEX`.
- `/home/runner/work/ai-board/ai-board/target/tests/integration/jobs/status.test.ts`: reuse callback/status transition patterns for setup-job callback coverage if a separate setup-status route mirrors current semantics.
- `/home/runner/work/ai-board/ai-board/target/tests/unit/components/projects/import-project-modal.test.tsx`: keep import modal redirect behavior aligned with the new setup entrypoint.
- `/home/runner/work/ai-board/ai-board/target/tests/unit/components/config-card.test.tsx`: extend for onboarding artifact review card integration if colocated.
- `/home/runner/work/ai-board/ai-board/target/tests/unit/credential-dispatch-guard.test.ts`: extend provider-aware onboarding dispatch guard logic.
- `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-schema.test.ts`: extend if setup API introduces a dedicated selected-agent schema wrapper.

### New test files only where existing ownership is insufficient

- `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup.test.ts`: for project-scoped setup GET/POST/status APIs because no existing integration file currently owns setup job lifecycle behavior.
- `/home/runner/work/ai-board/ai-board/target/tests/unit/components/projects/setup-page.test.tsx`: for the setup page state machine because no current component test covers owner-only setup/resume/retry behavior.
- `/home/runner/work/ai-board/ai-board/target/tests/e2e/project-setup-onboarding.spec.ts`: only if integration tests cannot credibly validate project-entry redirect/resume behavior across browser refresh and client polling.

### Coverage targets by user story

- User Story 1: integration coverage for import redirect and setup start, plus component coverage for agent selection and success summary.
- User Story 2: integration coverage for credential-blocked and duplicate-run rejection, plus unit coverage for disabled CTA states.
- User Story 3: integration coverage for failed setup retry and artifact review/update APIs, plus selective E2E only if browser refresh semantics require it.
