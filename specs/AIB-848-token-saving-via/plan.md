# Implementation Plan: Token saving via RTK + unified per-ticket Run settings

**Branch**: `AIB-848-token-saving-via` | **Date**: 2026-06-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/AIB-848-token-saving-via/spec.md`

## Summary

Add token-saving run settings across project defaults, ticket overrides, job telemetry, and Claude core workflow execution. The design uses RTK only for Claude stage-transition commands, captures the effective setting on each `Job`, reports active/fallback/not-applicable status through the existing workflow status callback, and consolidates ticket agent/model/policy/token-saving controls into one Run settings dialog.

## Technical Context

**Language/Version**: TypeScript 5.9 strict, Node.js 22.20.0, React 18.3.1  
**Primary Dependencies**: Next.js 16 App Router, Prisma 6.19.2, PostgreSQL, NextAuth.js, TanStack Query v5.95.2, shadcn/ui + Radix, lucide-react, GitHub Actions workflows, RTK CLI for Claude shell-hook token saving  
**Storage**: PostgreSQL via Prisma schema and migrations  
**Testing**: Vitest unit/component/integration tests; Playwright only if browser-only behavior cannot be covered by RTL/integration tests  
**Target Platform**: Next.js web app on Node.js plus Ubuntu GitHub Actions workflow runners  
**Project Type**: Web application with server routes, Prisma persistence, React client components, and CI workflow scripts  
**Performance Goals**: No token-saving setup overhead when disabled; project default changes visible after normal dashboard/ticket polling or refresh; job status shown by terminal state  
**Constraints**: Project token-saving default OFF by default and owner-controlled; ticket override follows existing agent/policy stage editability; non-Claude agents and auxiliary workflows unaffected; RTK failures must fail open; no new savings estimator  
**Scale/Scope**: One project setting, one ticket override, one run-captured job status, one unified ticket Run settings dialog, three core workflow files, and central runner activation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- TypeScript-first development: PASS. All planned source changes are TypeScript or typed Prisma schema changes. New API fields require Zod validation and explicit shared types.
- Component-driven architecture: PASS. UI uses existing shadcn/Radix components and extends feature components under `components/settings`, `components/tickets`, `components/board`, and `components/ticket`.
- Test-driven development: PASS. Existing tests were inventoried first and will be extended rather than duplicated.
- Security-first design: PASS. Project default uses owner-only authorization; ticket override uses existing ticket access; workflow reporting uses existing bearer-token status endpoint; no secrets are logged.
- Database integrity: PASS. Prisma migration required; job-captured state is immutable for historic runs; full clone uses existing transaction pattern.
- Specification clarification guardrails: PASS. Spec contains auto-resolved decisions and this plan preserves the conservative scope.

Post-design re-check: PASS. No unresolved clarifications remain and no unjustified constitution violations were introduced.

## Project Structure

### Documentation (this feature)

```text
specs/AIB-848-token-saving-via/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   └── run-settings-api.md
├── workflows/
│   ├── run-settings-resolution.md
│   └── claude-token-saving-activation.md
└── tasks.md
```

`tasks.md` is intentionally not created by this planning command.

### Source Code (repository root)

```text
app/
├── api/jobs/[id]/status/route.ts
├── api/projects/[projectId]/route.ts
├── api/projects/[projectId]/tickets/[id]/jobs/route.ts
├── api/projects/[projectId]/tickets/[id]/model-config/route.ts
├── api/projects/[projectId]/tickets/[id]/route.ts
├── lib/job-update-validator.ts
├── lib/schemas/clarification-policy.ts
└── projects/[projectId]/settings/page.tsx

components/
├── board/ticket-detail-modal.tsx
├── settings/clarification-policy-card.tsx
├── settings/default-agent-card.tsx
├── settings/token-saving-card.tsx
├── ticket/jobs-timeline.tsx
├── ticket/ticket-stats.tsx
└── tickets/run-settings-dialog.tsx

lib/
├── db/auth-helpers.ts
├── db/projects.ts
├── db/tickets.ts
├── types/job-types.ts
├── utils/field-edit-permissions.ts
└── workflows/
    ├── model-resolution.ts
    ├── token-saving-resolution.ts
    └── transition.ts

prisma/
├── schema.prisma
└── migrations/

.github/
├── scripts/run-agent.sh
└── workflows/
    ├── speckit.yml
    ├── quick-impl.yml
    └── verify.yml

tests/
├── integration/jobs/status.test.ts
├── integration/jobs/ticket-jobs.test.ts
├── integration/projects/settings.test.ts
├── integration/tickets/duplicate.test.ts
├── integration/tickets/model-override.test.ts
├── integration/tickets/transitions.test.ts
├── unit/components/jobs-timeline.test.tsx
├── unit/components/ticket-detail-modal.test.tsx
├── unit/components/ticket-stats.test.tsx
├── unit/job-update-validator.test.ts
└── unit/workflows/model-resolution.test.ts
```

**Structure Decision**: Use the existing Next.js/Prisma monolith structure. Add only two new feature files where no current file owns the responsibility: `components/settings/token-saving-card.tsx`, `components/tickets/run-settings-dialog.tsx`, and `lib/workflows/token-saving-resolution.ts`. Extend all other listed files in place.

## Phase 0: Research Output

Completed in [research.md](research.md).

Key findings:

- Existing Project/Ticket/Job models already contain the right ownership boundaries for defaults, overrides, and run telemetry.
- Existing transition code creates a pending job before dispatch and cleans it up on dispatch failure; token-saving capture belongs at that job-creation boundary.
- Existing status callback supports idempotent RUNNING metadata updates; token-saving activation/fallback reporting should extend it.
- Existing ticket detail modal owns the current separate policy/agent/model dialogs; the new dialog should reuse those behaviors and remove the three separate menu actions.

## Phase 1: Design Output

Completed artifacts:

- [data-model.md](data-model.md)
- [contracts/run-settings-api.md](contracts/run-settings-api.md)
- [workflows/run-settings-resolution.md](workflows/run-settings-resolution.md)
- [workflows/claude-token-saving-activation.md](workflows/claude-token-saving-activation.md)

## Implementation Phases

1. Data and generated types
   - Add Prisma enums/fields from `data-model.md`.
   - Create a Prisma migration and run `bunx prisma generate`.
   - Extend job/ticket/project shared TypeScript types and serializers.

2. Settings and run-settings APIs
   - Extend project GET/PATCH with `tokenSavingEnabled`.
   - Enforce owner-only authorization for project token-saving default with `verifyProjectOwnership`.
   - Extend ticket GET/PATCH with `tokenSavingOverride` and derived effective state.
   - Keep model-config endpoint behavior unchanged for the Models section.

3. Resolution and transition dispatch
   - Add `lib/workflows/token-saving-resolution.ts`.
   - Use the fresh ticket snapshot in `lib/tickets/transition.ts` and job creation in `lib/workflows/transition.ts`.
   - Pass captured token-saving input into `speckit.yml`, `quick-impl.yml`, and `verify.yml`.

4. Workflow activation and reporting
   - Extend `.github/scripts/run-agent.sh` with Claude/core-command gated RTK setup.
   - Report `ACTIVE`/`FALLBACK` through `PATCH /api/jobs/:id/status`.
   - Ensure auxiliary Claude commands and non-Claude agents report inactive/not-applicable and skip RTK.

5. UI consolidation
   - Add `TokenSavingCard` to project settings.
   - Add `RunSettingsDialog` with Agent, Models, Clarification policy, and Token saving sections.
   - Replace ticket menu `Edit Policy`, `Edit Agent`, and `Edit Models` with `Run settings`.
   - Preserve Simple copy and Full clone visibility rules.
   - Add ticket header indicator only when current effective token saving is ON.
   - Add job timeline status row for run-captured token-saving status.

6. Duplication and comparison support
   - Preserve ticket token-saving override in simple copy and full clone.
   - Copy job token-saving status fields in full clone job snapshots.
   - Keep existing telemetry as the source for savings comparison.

## Testing Strategy

Follow the constitution's testing trophy and extend existing files first:

- `tests/integration/projects/settings.test.ts`: project default OFF, owner update, member rejection for token-saving default, validation, response shape.
- `tests/integration/tickets/transitions.test.ts`: job captures effective setting for inherited ON/OFF, force ON/OFF, non-Claude not-applicable, and core command scoping.
- `tests/integration/jobs/status.test.ts`: status callback accepts active/fallback, preserves first-write-wins/idempotency, rejects invalid status/reason.
- `tests/integration/jobs/ticket-jobs.test.ts`: jobs API returns token-saving telemetry fields.
- `tests/integration/tickets/duplicate.test.ts`: simple copy preserves ticket override; full clone copies job token-saving status snapshot.
- `tests/unit/workflows/model-resolution.test.ts` or a new adjacent resolver test: token-saving precedence and command/agent applicability. Create a new file only if adding to model-resolution would mix unrelated concerns.
- `tests/unit/job-update-validator.test.ts`: Zod schema accepts and rejects token-saving callback fields.
- `tests/unit/components/ticket-detail-modal.test.tsx`: menu shows Run settings, does not show separate policy/agent/model actions, preserves copy/clone items, and shows effective ON indicator.
- `tests/unit/components/jobs-timeline.test.tsx`: active, inactive, fallback with reason, not applicable, and not recorded display states.
- `tests/unit/components/ticket-stats.test.tsx`: merged job data preserves token-saving fields during polling.

Default to `bun run test:integration` for API/database behavior and `bun run test:unit <path>` for component/resolver/schema tests. Avoid new Playwright tests unless RTL cannot cover a browser-only interaction.

## Complexity Tracking

No constitution violations or complexity exceptions.
