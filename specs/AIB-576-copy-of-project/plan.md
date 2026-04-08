# Implementation Plan: Project Onboarding Setup Flow

**Branch**: `AIB-576-copy-of-project` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-576-copy-of-project/spec.md`

## Summary

Implement the missing onboarding path for imported repositories without synced `.ai-board/config.yml`. The feature adds a dedicated `/projects/[projectId]/setup` experience, owner-only setup start/retry APIs, workflow-authenticated setup status callbacks, persistent setup-attempt history, and completion-driven config synchronization so projects reliably enter the board only after onboarding has finished cleanly.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 App Router, React 18, TanStack Query v5.95.2, Prisma 6.x, shadcn/ui, lucide-react  
**Storage**: PostgreSQL 14+ via Prisma; existing `Project`, `UserCredential`, and `config/configSyncedAt` fields plus a new setup-attempt model  
**Testing**: Vitest integration for setup APIs and lifecycle transitions, RTL component tests for setup UI, Playwright only if an existing browser-only gap remains after integration coverage  
**Target Platform**: Web application on Next.js App Router with GitHub Actions workflow callbacks  
**Project Type**: Multi-repository web application with centralized workflow execution in the ai-board repo  
**Performance Goals**: Setup status visible within the existing 15s polling window, duplicate starts rejected synchronously, redirect decisions made on first page load  
**Constraints**: Owner-only control, member-visible status, authenticated workflow callbacks, no dynamic Tailwind classes, config sync remains authoritative for “setup complete”  
**Scale/Scope**: 1 new page route, 3 new setup API routes, 1 new Prisma model + enum, workflow definition for onboarding, updates to import/board entry guards and existing tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gates

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | Plan uses explicit DTOs, Prisma enums/models, and typed polling responses; no `any`-based escape hatches required. |
| II. Component-Driven Architecture | ✅ PASS | Setup UI will compose existing shadcn/ui primitives and live under the existing project/components structure. |
| III. Test-Driven Development | ✅ PASS | Plan extends existing import, project, credential, and workflow-status test suites before adding any new setup-specific test files. |
| IV. Security-First Design | ✅ PASS | Owner-only mutations, workflow token auth for callbacks, Zod request validation, and provider-aware credential readiness checks are required. |
| V. Database Integrity | ✅ PASS | New attempt records are created transactionally and remain consistent when dispatch or sync fails; latest state is derived from persisted attempts plus `Project.configSyncedAt`. |
| V. Specification Clarification Guardrails | ✅ PASS | The spec already documents AUTO→CONSERVATIVE decisions; all remaining planning unknowns are resolved in `research.md`. |

### Complexity Assessment

- **New schema surface**: One new model and one enum are justified because attempt history is a first-class requirement.
- **New routes**: The setup flow needs dedicated read/start/callback endpoints instead of overloading job APIs with unrelated semantics.
- **Workflow coordination**: A minimal onboarding workflow is required because FR-020 explicitly demands end-to-end execution through callback and completion.
- **No unjustified violations**: The design reuses existing auth helpers, credential plumbing, config sync, and workflow-auth conventions instead of introducing parallel subsystems.

## Project Structure

### Documentation (this feature)

```text
specs/AIB-576-copy-of-project/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   └── project-setup-api.md
└── workflows/
    ├── project-onboarding-workflow.md
    ├── project-onboarding-command.md
    ├── project-onboarding-callback.md
    └── config-sync-after-completion.md
```

### Source Code (planned implementation)

```text
app/
├── projects/
│   └── [projectId]/
│       ├── page.tsx                                  # NEW: canonical project-entry redirect
│       ├── board/page.tsx                            # MODIFY: guard direct board access when setup is still required
│       └── setup/page.tsx                            # NEW: setup experience
└── api/
    └── projects/
        └── [projectId]/
            ├── route.ts                              # MODIFY: expose setup-related fields in project detail response
            └── setup/
                ├── route.ts                          # NEW: latest setup state/read model
                └── attempts/
                    ├── route.ts                      # NEW: owner-only start/retry endpoint
                    └── [attemptId]/
                        └── status/route.ts           # NEW: workflow-authenticated callback endpoint

components/
└── projects/
    ├── import-project-modal.tsx                     # MODIFY: preserve redirect behavior and setup warning messaging
    ├── project-card.tsx                             # MODIFY: route through canonical project entry instead of hardcoded `/board`
    ├── project-setup-page.tsx                       # NEW: setup screen container
    ├── project-setup-status.tsx                     # NEW: pending/running/failed/completed state renderer
    └── project-setup-start-form.tsx                 # NEW: owner controls for agent selection and retry

lib/
├── db/
│   ├── auth-helpers.ts                              # REUSE: owner/member authorization split
│   └── projects.ts                                  # MODIFY: include setup metadata helpers if shared by pages/routes
├── ai-credentials/
│   └── workflow.ts                                  # REUSE: provider-aware owner credential lookup
├── config-sync.ts                                   # REUSE: completion-time config synchronization
└── project-setup/
    ├── types.ts                                     # NEW: DTOs and derived setup-state types
    ├── service.ts                                   # NEW: start/retry/callback orchestration
    ├── state.ts                                     # NEW: status transitions and “latest attempt wins” rules
    └── workflow-dispatch.ts                         # NEW: dispatch minimal onboarding workflow

prisma/
└── schema.prisma                                    # MODIFY: new setup attempt model + enum

.github/workflows/
└── project-onboarding.yml                           # NEW: minimal onboarding workflow exercising dispatch→callback→sync

tests/
├── integration/
│   ├── projects/import.test.ts                      # EXTEND
│   ├── projects/config-sync.test.ts                 # EXTEND
│   ├── projects/crud.test.ts                        # EXTEND
│   ├── projects/setup.test.ts                       # NEW if no existing project test file can cover the endpoint matrix cleanly
│   ├── credentials/workflow-credential.test.ts      # EXTEND
│   └── jobs/status.test.ts                          # REUSE pattern for workflow-auth callback coverage
└── unit/
    └── components/projects/import-project-modal.test.tsx   # EXTEND
```

**Structure Decision**: Keep setup-specific orchestration in a focused `lib/project-setup/` module, reuse existing page/API conventions under `app/projects/[projectId]`, and add new files only where no current module cleanly owns the responsibility.

## Phase 0: Research Outcome

Phase 0 is complete in [research.md](./research.md). All technical unknowns were resolved:

- Persist each retry as a separate project-scoped setup attempt.
- Keep project completion authoritative on `config` + `configSyncedAt`; a callback reporting `COMPLETED` is only final after sync succeeds.
- Reuse workflow token authentication for callbacks instead of introducing per-attempt secrets.
- Reuse provider-aware owner credential lookup by mapping selected agent to credential provider.
- Add a canonical `/projects/[projectId]` entry redirect and a direct `/board` guard so no path bypasses setup requirements.

## Phase 1: Design Artifacts

Phase 1 outputs are complete:

- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/project-setup-api.md](./contracts/project-setup-api.md)
- [workflows/project-onboarding-workflow.md](./workflows/project-onboarding-workflow.md)
- [workflows/project-onboarding-command.md](./workflows/project-onboarding-command.md)
- [workflows/project-onboarding-callback.md](./workflows/project-onboarding-callback.md)
- [workflows/config-sync-after-completion.md](./workflows/config-sync-after-completion.md)

## Testing Strategy

Follow the constitution’s “extend existing tests first” rule:

- Extend `tests/integration/projects/import.test.ts` to verify config-missing imports redirect to `/projects/{id}/setup`, not a dead-end path.
- Extend `tests/integration/projects/crud.test.ts` for project detail payload changes and canonical project-entry redirect behavior if that stays API-observable.
- Extend `tests/integration/projects/config-sync.test.ts` for post-completion sync success and sync-failure behavior.
- Extend `tests/integration/credentials/workflow-credential.test.ts` for agent-selected provider readiness checks during setup start.
- Reuse the patterns in `tests/integration/jobs/status.test.ts` and `tests/helpers/workflow-auth.ts` for workflow-token callback coverage.
- Extend `tests/unit/components/projects/import-project-modal.test.tsx` for setup redirect handling and any owner guidance copy.
- Create `tests/integration/projects/setup.test.ts` only if setup endpoints and lifecycle coverage would otherwise mix unrelated concerns into existing project tests.

## Complexity Tracking

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Setup completion semantics | Mark attempt `COMPLETED` only after config sync succeeds; otherwise persist `FAILED` with sync error | Prevents false-positive onboarding success while preserving retryability |
| Status authority | Derive current setup state from latest attempt plus current project config | Matches FR-016/017 and avoids duplicating mutable project-level status fields |
| Callback idempotency | Accept only legal forward transitions and ignore stale terminal callbacks from superseded attempts | Preserves history and prevents older retries from corrupting current state |
| UI gating | Guard both `/projects/[projectId]` and `/projects/[projectId]/board` | Prevents setup bypass from existing links and direct URLs |

## Post-Design Constitution Re-Check

| Principle | Status | Verification |
|-----------|--------|--------------|
| I. TypeScript-First | ✅ PASS | `data-model.md` defines concrete Prisma/App-layer types and response DTOs; no unresolved typing gaps remain. |
| II. Component-Driven Architecture | ✅ PASS | Setup UI stays within `components/projects/` and uses shadcn/ui patterns consistent with import/settings surfaces. |
| III. Test-Driven Development | ✅ PASS | Existing test inventory is documented in `research.md`; only one new integration file is conditionally introduced. |
| IV. Security-First Design | ✅ PASS | Owner-only writes, member read-only status, workflow token callback auth, and Zod validation are explicitly part of the contracts. |
| V. Database Integrity | ✅ PASS | Attempt creation and dispatch failure handling are modeled to avoid orphaned “active” rows and stale success states. |
| V. Specification Clarification Guardrails | ✅ PASS | No `NEEDS CLARIFICATION` items remain after research. |

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | `specs/AIB-576-copy-of-project/research.md` | ✅ Complete |
| Data Model | `specs/AIB-576-copy-of-project/data-model.md` | ✅ Complete |
| API Contract | `specs/AIB-576-copy-of-project/contracts/project-setup-api.md` | ✅ Complete |
| Workflow Design | `specs/AIB-576-copy-of-project/workflows/*.md` | ✅ Complete |
| Agent Context | `CLAUDE.md` | ✅ Updated |

## Next Step

Run the implementation task generator for this branch after reviewing the plan artifacts.
