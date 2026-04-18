# Implementation Plan: Per-Stage Model Configuration for Claude Workflows

**Branch**: `AIB-678-per-stage-model` | **Date**: 2026-04-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-678-per-stage-model/spec.md`

## Summary

Add per-stage Claude model configuration at both project and ticket scope, resolved at workflow dispatch time and written into `Job.model`. Storage is 5 nullable VARCHAR columns on each of `Project` and `Ticket` (one per configurable stage: SPECIFY, PLAN, IMPLEMENT, QUICK-IMPL, VERIFY). Resolution order is **ticket override → project default → hard-coded Opus 4.7 fallback**, short-circuiting to `null` (no override) when the effective agent is not Claude. A code-owned 4-entry whitelist gates every write. New projects are seeded with cost-conscious smart defaults (Opus 4.7 for SPECIFY/PLAN; Sonnet 4.6 for IMPLEMENT/QUICK-IMPL/VERIFY) via the existing project-creation transaction. Existing projects remain all-null and therefore byte-for-byte identical to pre-feature behavior. UI surface: a new "AI Models" settings card mirroring `ClarificationPolicyCard`, a new per-ticket `ModelOverrideDialog` mirroring `AgentEditDialog`, and a "Custom models" badge on the ticket card.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, TanStack Query v5.95.2, Zod, shadcn/ui, TailwindCSS 3.4
**Storage**: PostgreSQL 14+ via Prisma. 10 new nullable `VARCHAR(50)` columns: 5 on `Project`, 5 on `Ticket`. No new tables. Existing `Job.model` reused.
**Testing**: Vitest (unit + integration), Playwright (E2E only if browser-specific — not expected here). RTL for components. Worker-isolated integration tests per project conventions.
**Target Platform**: Linux server (Vercel/Node) + modern browsers
**Project Type**: Web application (Next.js App Router, single repo with both backend routes and frontend components)
**Performance Goals**: Optimistic update ≤ 200 ms (SC-007). Resolution is O(1) column reads already joined in the transition query — no added DB roundtrips.
**Constraints**: Must preserve existing dispatch behavior for pre-feature projects (FR-007, SC-003). Must not affect non-Claude dispatches (FR-015, SC-002). All 4 whitelisted model IDs are closed-set; rejection on unknown values at every write (FR-002, FR-019). Stored ticket overrides MUST survive agent swaps (FR-013, SC-010).
**Scale/Scope**: ~10k users, ~5 stages per project/ticket. Feature adds ≤ 15 files (see Project Structure) and touches ~5 existing files.

## Constitution Check

Evaluated against `.ai-board/memory/constitution.md` v1.8.0.

| Principle                              | Gate                                                                                                              | Pass? | Notes |
|----------------------------------------|-------------------------------------------------------------------------------------------------------------------|-------|-------|
| **I. TypeScript-First Development**    | No `any`; all function signatures typed; API responses have TS interfaces.                                        | PASS  | `ClaudeModelId` union type generated from `CLAUDE_MODEL_IDS as const`; resolution function and Zod schemas fully typed. |
| **II. Component-Driven Architecture**  | Use shadcn/ui exclusively; Client Components only when needed; feature folders; no sub-components <40 lines.       | PASS  | New card + dialog reuse shadcn `Card`, `Select`, `Dialog`, `Button` — mirroring `ClarificationPolicyCard` and `AgentEditDialog`. |
| **III. TDD (NON-NEGOTIABLE)**          | Tests verify behavior; extend existing test files; no assertions in conditionals; mock paths match imports.        | PASS  | Testing strategy below extends 4 existing files and adds 6 new unit/integration files; E2E avoided (no browser-specific flow). |
| **IV. Security-First Design**          | Zod validation at every boundary; Zod constraints match DB; no raw SQL; auth middleware on protected routes.       | PASS  | `VARCHAR(50)` matches `claudeModelIdSchema`; all endpoints gated by `verifyProjectAccess` / `verifyTicketAccess`; whitelist refine enforces closed set. |
| **V. Database Integrity**              | Prisma migrations; transactions for multi-step ops; no use of pre-mutation in-memory state; consistent on failure. | PASS  | Single migration for 10 columns (nullable, no backfill). Smart-defaults seeded inside existing project-creation `$transaction`. Existing dispatch-then-rollback pattern preserved. |
| **V. Clarification Guardrails**        | `AUTO` resolves to `CONSERVATIVE`; safeguards retained; Auto-Resolved Decisions summary present.                   | PASS  | Spec already documents 6 auto-resolved decisions; no safeguards trimmed; whitelist + strict rejection selected over silent coercion. |
| **Optimistic updates** (State Mgmt)    | All mutations use optimistic updates with revert-on-error.                                                         | PASS  | Follow `ClarificationPolicyCard` revert pattern (Pattern P2). |

**Verdict**: No violations. No complexity tracking entries needed.

Re-evaluated after Phase 1 (data-model.md + contracts/): still PASS. The chosen column-based storage aligns with existing `defaultAgent` / `clarificationPolicy` patterns; no new tables, no new auth shape, no new state machines introduced.

## Project Structure

### Documentation (this feature)

```
specs/AIB-678-per-stage-model/
├── plan.md                     # This file
├── research.md                 # Phase 0: decisions, existing files, patterns
├── data-model.md               # Phase 1: Prisma changes + entity semantics
├── contracts/
│   ├── project-model-config.md # PATCH /api/projects/:id + smart-defaults POST
│   ├── ticket-model-override.md# PATCH .../tickets/:id/model-config
│   └── workflow-dispatch.md    # Dispatch payload + Job.model write
├── checklists/                 # Pre-existing from earlier phase
├── spec.md                     # Input (already exists)
└── tasks.md                    # Phase 2 output (/ai-board.tasks, NOT this command)
```

### Source Code (repository root)

```
prisma/
└── schema.prisma                                    # EXTEND: +5 cols on Project, +5 on Ticket

lib/
├── models/
│   └── claude-models.ts                             # NEW: whitelist, labels, smart defaults, type guard
└── workflows/
    ├── transition.ts                                # EXTEND: call resolveStageModel, pass model to Job + workflowInputs
    └── model-resolution.ts                          # NEW: pure resolveStageModel function

app/
├── api/
│   └── projects/
│       ├── route.ts                                 # EXTEND: seed SMART_DEFAULTS inside existing $transaction
│       └── [projectId]/
│           ├── route.ts                             # EXTEND: PATCH accepts 5 new fields
│           ├── model-config/
│           │   └── apply-smart-defaults/route.ts    # NEW: POST
│           └── tickets/[id]/
│               └── model-config/route.ts            # NEW: PATCH ticket overrides
└── lib/schemas/
    ├── clarification-policy.ts                      # EXTEND: projectUpdateSchema adds 5 model fields
    └── model-config.ts                              # NEW: claudeModelIdSchema + ticketModelOverrideSchema

components/
├── settings/
│   └── ai-models-card.tsx                           # NEW: 5-row card w/ Apply Smart Defaults + non-Claude info branch
├── tickets/
│   └── model-override-dialog.tsx                    # NEW: 5-row override dialog + Reset All + non-Claude branch
└── board/
    └── ticket-card.tsx                              # EXTEND: render "Custom models" badge w/ dormant variant

tests/
├── unit/
│   ├── workflows/model-resolution.test.ts           # NEW: pure-function resolution chain tests
│   └── components/
│       ├── ai-models-card.test.tsx                  # NEW
│       └── model-override-dialog.test.tsx           # NEW
└── integration/
    ├── projects/
    │   ├── settings.test.ts                         # EXTEND: per-stage PATCH cases
    │   ├── crud.test.ts                             # EXTEND: creation seeds SMART_DEFAULTS
    │   └── model-config.test.ts                     # NEW: apply-smart-defaults endpoint
    └── tickets/
        ├── transitions.test.ts                      # EXTEND: Job.model + workflowInputs.model + dormant branch
        └── model-override.test.ts                   # NEW: ticket model-config endpoint
```

**Structure Decision**: Web application layout already established by this codebase. New code groups into existing conventions — `lib/models/` (new utility namespace) + `lib/workflows/` (existing), `components/settings/` and `components/tickets/` (existing), `app/api/projects/...` (existing, extended with two new sub-routes). No architectural divergence from constitution §II.

## Testing Strategy

Derived from constitution §III and the "Existing Files" inventory in `research.md`. Default is **Vitest** (unit or integration); E2E reserved for browser-only flows, none of which apply here.

### Pure-function / resolution logic

- **`tests/unit/workflows/model-resolution.test.ts`** (NEW)
  - Resolves ticket > project > fallback for each of the 5 commands.
  - Ignores non-configurable commands (iterate, comment-*, health-scan) → returns null.
  - Returns null when effective agent is not Claude, even if ticket/project columns are set.
  - Unknown stored ID on ticket column falls through to project column.
  - Unknown stored ID on both → returns fallback.

### Validation & API endpoints (integration tests, Vitest)

- **`tests/integration/projects/settings.test.ts`** (EXTEND)
  - GET reflects all 5 new columns.
  - PATCH each column independently (Sonnet 4.6 → Opus 4.6, etc.); other 4 stages isolated.
  - PATCH with unknown ID → 400 `INVALID_MODEL_ID` + actionable message.
  - PATCH with `null` on a column → resets that stage.
  - PATCH by non-owner non-member → 404 (matches existing `verifyProjectAccess` behavior).
  - Member (not owner) can PATCH — proves FR-018 parity.

- **`tests/integration/projects/crud.test.ts`** (EXTEND)
  - New project created via POST persists all 5 `SMART_DEFAULTS` values (SC-004).
  - Creation failure (quota) doesn't leave partial model config (transaction rollback).

- **`tests/integration/projects/model-config.test.ts`** (NEW)
  - POST apply-smart-defaults overwrites all 5 atomically.
  - Idempotent (second call yields identical state).
  - Auth: member allowed; non-member 404.

- **`tests/integration/tickets/model-override.test.ts`** (NEW)
  - PATCH sets a single stage override (VERIFY = Opus 4.7); others remain null.
  - `{ resetAll: true }` nulls all 5.
  - Unknown model ID → 400.
  - Empty body → 400.
  - Auth: member allowed; non-member 404.
  - Ticket with stored overrides survives a PATCH to `defaultAgent` on the project (FR-013 — overrides not auto-cleared).

- **`tests/integration/tickets/transitions.test.ts`** (EXTEND)
  - Job created by INBOX→SPECIFY transition has `model` populated with the resolved model (project default case).
  - Ticket override wins over project default (IMPLEMENT override = Haiku; project default IMPLEMENT = Sonnet → Job.model = Haiku).
  - Effective agent = Gemini + ticket has IMPLEMENT override → Job.model is null; `workflowInputs` has no `model` key (FR-015, dormant behavior).
  - Job created by a non-configurable command (health-scan) has `model` null (FR-017).
  - GitHub dispatch failure still deletes the Job (dispatch-then-rollback preserved).

### Component tests (Vitest + RTL)

- **`tests/unit/components/ai-models-card.test.tsx`** (NEW)
  - Renders 5 selector rows when `project.defaultAgent === 'CLAUDE'`.
  - Renders informational message (not selectors) when `defaultAgent !== 'CLAUDE'` (FR-004).
  - Changing a selector triggers PATCH; optimistic update reflected immediately; revert on simulated network failure.
  - "Apply smart defaults" button visible; click triggers POST.

- **`tests/unit/components/model-override-dialog.test.tsx`** (NEW)
  - Renders 5 selectors with "Inherit from project default" as the first option on each.
  - Non-Claude agent branch renders info message, no selectors (FR-012).
  - "Reset all to project defaults" clears all selections.
  - Save button disabled when no changes.
  - Save failure surfaces error, dialog stays open, no silent swallow.

- **Ticket card badge** — covered by extending existing board/ticket-card tests if present, otherwise inline in the new override dialog test file (decide during tasks). Asserts:
  - No badge when all 5 ticket model columns are null.
  - Badge present when any is non-null; tooltip enumerates the overridden stages.
  - Dormant style when effective agent is non-Claude but any override exists (FR-021).

### What we are NOT writing

- **E2E (Playwright)**: no browser-only flows (no drag-drop, no OAuth). Skipped per constitution decision tree.
- **Separate tests for Zod schemas in isolation**: coverage comes through the integration PATCH cases, which exercise the schema end-to-end.
- **Dedicated tests for `Job.model` telemetry aggregation**: existing `tests/unit/telemetry/aggregation.test.ts` already covers aggregation; we only change *when* the field is first written, not how it is aggregated.

## Complexity Tracking

No violations. Section intentionally empty.

---

## Phase 2 handoff

This command stops here. The next command (`/ai-board.tasks`) should:

1. Read `research.md`, `data-model.md`, and `contracts/*.md`.
2. Produce `tasks.md` following the dependency order implied by Project Structure (schema → pure utilities → resolution → transition wiring → API endpoints → UI → tests).
3. Prefer extending existing test files over creating new ones where coverage overlaps (constitution §III).
4. Flag the `.github/workflows/*.yml` updates as a cross-cutting task so the `model` workflow input is accepted when dispatched.

## Artifacts generated this run

- `specs/AIB-678-per-stage-model/plan.md` (this file)
- `specs/AIB-678-per-stage-model/research.md`
- `specs/AIB-678-per-stage-model/data-model.md`
- `specs/AIB-678-per-stage-model/contracts/project-model-config.md`
- `specs/AIB-678-per-stage-model/contracts/ticket-model-override.md`
- `specs/AIB-678-per-stage-model/contracts/workflow-dispatch.md`
- `CLAUDE.md` touched by `update-agent-context.sh`
