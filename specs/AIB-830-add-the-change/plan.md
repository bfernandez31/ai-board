# Implementation Plan: Per-Stage Model Selection for Codex Agent

**Branch**: `AIB-830-add-the-change` | **Date**: 2026-05-29 | **Spec**: `specs/AIB-830-add-the-change/spec.md`
**Input**: Feature specification from `specs/AIB-830-add-the-change/spec.md`

## Summary

Bring the per-stage model selection feature already shipped for the Claude agent (AIB-678) to the Codex agent at parity. Project owners whose `defaultAgent` is `CODEX` will be able to pick a specific Codex model — from a curated whitelist `gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.3-codex, gpt-5.2` — for each of the five workflow stages (SPECIFY, PLAN, IMPLEMENT, QUICK-IMPL, VERIFY), with per-ticket overrides, smart-default seeding, and graceful fall-through to the `gpt-5.5` global fallback when no configuration is set or a stored identifier has been deprecated.

Technical approach: add 10 new nullable `codex*Model` columns to `Project` and `Ticket` mirroring the existing Claude columns; extend the resolver in `lib/workflows/model-resolution.ts` with a Codex branch that follows the same ticket → project → fallback chain; extend the existing PATCH endpoints and smart-defaults endpoint to accept Codex payloads; render Codex dropdowns in the existing AI Models card and ticket override dialog based on `defaultAgent`. No new routes, no new components, no new tables — everything is a parallel extension of an existing, well-tested feature.

## Technical Context

**Language/Version**: TypeScript 5.9 strict, Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, Zod, TanStack Query v5, shadcn/ui, lucide-react
**Storage**: PostgreSQL 14+ via Prisma (10 new VarChar(50) columns, all nullable, no indexes)
**Testing**: Vitest (unit + integration) — extend existing files under `tests/unit/workflows/`, `tests/integration/projects/`, `tests/integration/tickets/`; Playwright E2E is NOT required (no new UI flow that demands a browser)
**Target Platform**: Linux server (Vercel deployment) + browser UI
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Resolver is O(1) and synchronous; PATCH endpoints unchanged in latency budget; apply-smart-defaults is a single `prisma.project.update` (one round-trip)
**Constraints**: Preserve dormancy contract (switching agents must NEVER overwrite the dormant agent's stored configuration); preserve dispatch-then-rollback atomicity (Pattern P1); zero new authorization helpers — reuse `verifyProjectAccess` and `verifyTicketAccess`
**Scale/Scope**: ~10 new columns, ~6 source files modified, ~3 source files created, ~4 test files extended, 1 Prisma migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status |
|-----------|-------------|--------|
| I. TypeScript-First | strict mode, no `any`, typed exports | **Pass** — new constants typed via `as const` literal unions; `isCodexModelId` returns `value is CodexModelId`; resolver return type widens to `ClaudeModelId \| CodexModelId \| null` |
| II. Component-Driven | shadcn/ui only; feature folder layout | **Pass** — extending existing `components/settings/ai-models-card.tsx` and `components/tickets/model-override-dialog.tsx`; no new primitives |
| III. TDD | Tests verify behavior; search existing tests first; mocks target import path | **Pass** — research.md identifies 3 existing test files to EXTEND (`model-resolution.test.ts`, `model-config.test.ts`, `model-override.test.ts`); no duplication; no new files unless RTL component tests are missing |
| IV. Security-First | Zod validation; parameterized queries; authorization on protected routes | **Pass** — new `codexModelIdSchema` extends Zod refine pattern; existing `verifyProjectAccess` / `verifyTicketAccess` reused unchanged; no raw SQL |
| V. Database Integrity | Migrations via Prisma; transactions for multi-table ops; soft deletes where applicable | **Pass** — single migration adds 10 nullable columns; no transaction needed (single-table update); no user-generated content involved so no soft-delete consideration |
| V (Clarification Guardrails) | AUTO defaults to CONSERVATIVE on low confidence; PRAGMATIC retains security controls | **Pass** — spec's auto-resolved decisions used CONSERVATIVE for storage strategy (D2) and PRAGMATIC for whitelist + defaults + fallback (D1, D5, D6) with documented reviewer notes |

**Gate result**: PASS. No violations. Complexity Tracking section below is empty.

## Project Structure

### Documentation (this feature)

```
specs/AIB-830-add-the-change/
├── plan.md                                # This file
├── research.md                            # Phase 0 — existing files, patterns, decisions
├── data-model.md                          # Phase 1 — schema + constants + validation
├── contracts/
│   ├── project-codex-model-config.md      # PATCH /api/projects/:id + apply-smart-defaults
│   ├── ticket-codex-model-override.md     # PATCH .../tickets/:id/model-config
│   └── workflow-dispatch.md               # workflow_dispatch model input (Codex)
├── workflows/
│   ├── codex-model-resolution.md          # Internal process: resolver
│   └── apply-codex-smart-defaults.md      # Internal process: smart-defaults write
├── checklists/                            # (existing folder)
├── spec.md                                # Source spec (already on branch)
└── tasks.md                               # Phase 2 — generated by /ai-board.tasks
```

### Source Code (repository root)

```
prisma/
└── schema.prisma                          # MODIFY: +10 codex*Model columns on Project & Ticket
prisma/migrations/
└── <timestamp>_aib_830_codex_per_stage_models/
    └── migration.sql                      # CREATE: generated by prisma migrate

lib/
├── models/
│   ├── claude-models.ts                   # NO CHANGE (existing)
│   └── codex-models.ts                    # CREATE: CODEX_MODEL_IDS, _LABELS, _GLOBAL_FALLBACK_MODEL, _STAGE_MODEL_KEYS, _SMART_DEFAULTS, isCodexModelId, commandToCodexStageModelKey
├── workflows/
│   └── model-resolution.ts                # MODIFY: extend resolveStageModel with Codex branch
└── analysis/
    └── cost-table.ts                      # MODIFY: add pricing rows for gpt-5.4-mini, gpt-5.3-codex, gpt-5.2

app/lib/schemas/
├── model-config.ts                        # MODIFY: add codexModelIdSchema and ticketCodexModelOverrideSchema
└── clarification-policy.ts                # MODIFY: add 5 codex*Model fields to projectUpdateSchema

app/api/projects/[projectId]/
├── route.ts                               # MODIFY: extend error matcher to include codex*Model field names
├── model-config/apply-smart-defaults/
│   └── route.ts                           # MODIFY: branch on defaultAgent, write CODEX_SMART_DEFAULTS for CODEX
└── tickets/[id]/model-config/
    └── route.ts                           # MODIFY: detect Claude vs Codex payload, reject mixed, write appropriate columns

app/api/projects/
└── route.ts                               # MODIFY: seed CODEX_SMART_DEFAULTS in the create transaction alongside SMART_DEFAULTS

components/
├── settings/
│   └── ai-models-card.tsx                 # MODIFY: render Codex dropdowns when defaultAgent === CODEX
└── tickets/
    └── model-override-dialog.tsx          # MODIFY: render Codex dropdowns when effectiveAgent === CODEX

tests/unit/workflows/
└── model-resolution.test.ts               # EXTEND: add Codex describe block (ticket override, project fallback, global fallback, non-Codex returns null, stale fall-through, cross-agent isolation)

tests/integration/projects/
└── model-config.test.ts                   # EXTEND: add Codex tests (apply-smart-defaults on CODEX project, idempotency, member auth, outsider 404, UNSUPPORTED_AGENT for MISTRAL/GEMINI)

tests/integration/tickets/
└── model-override.test.ts                 # EXTEND: add Codex tests (single field, resetAll clears both, INVALID_MODEL_ID for unknown Codex, MIXED_AGENT_PAYLOAD rejection)

tests/unit/components/                     # (verify path at implementation time)
├── settings/ai-models-card.test.tsx       # EXTEND if exists; CREATE only if no covering file
└── tickets/model-override-dialog.test.tsx # EXTEND if exists; CREATE only if no covering file
```

**Structure Decision**: Single Next.js full-stack project (existing layout). All paths above are real and were verified during Phase 0 (`research.md` → Existing Files inventory). No directory restructuring needed.

## Implementation Phases

The implementation work below is broken into ordered phases. The `/ai-board.tasks` command will turn these into concrete task entries.

### Phase A — Schema, constants, validation (no behavior change)

1. **Schema migration** — Edit `prisma/schema.prisma` to add the 10 `codex*Model` columns on `Project` (after L132) and `Ticket` (after L197). Run `bunx prisma migrate dev --name aib_830_codex_per_stage_models`. Run `bunx prisma generate` to refresh the Prisma client.
2. **Codex constants** — Create `lib/models/codex-models.ts` mirroring `lib/models/claude-models.ts` line-for-line with the Codex IDs, labels, smart-defaults, fallback, and stage-key mapping documented in `data-model.md`.
3. **Zod schemas** — In `app/lib/schemas/model-config.ts`, add `codexModelIdSchema` and `ticketCodexModelOverrideSchema` (see `data-model.md` → Validation Rules). In `app/lib/schemas/clarification-policy.ts`, add the 5 new optional Codex fields to `projectUpdateSchema`.
4. **Cost-table extension** — In `lib/analysis/cost-table.ts`, add `MODEL_PRICING` rows for `gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.2`. Keep `DEFAULT_MODEL_BY_AGENT.CODEX = 'gpt-5.4'` (Decision D9 in research.md — divergence from resolver fallback is intentional).

### Phase B — Resolver extension (Pattern P3)

5. **Extend `resolveStageModel`** — In `lib/workflows/model-resolution.ts`, add a Codex branch alongside the Claude branch. Both branches MUST follow the same shape (stage-key lookup → ticket layer → project layer → fallback). Widen the return type to `ClaudeModelId | CodexModelId | null`. The call site at `lib/workflows/transition.ts:182` is unchanged — verify by running type-check. Pattern reference: `lib/workflows/model-resolution.ts:50–60`. See `workflows/codex-model-resolution.md` for the reference sketch.
6. **Update `TicketLikeForResolution` type** — Add the 5 `codex*Model` fields to `StageModelSource` (which is used for both ticket and `project`). This change is type-only; existing Claude tests continue to type-check (extra optional fields).

### Phase C — API extension (Patterns P4, P5, P6)

7. **Project PATCH error matcher** — In `app/api/projects/[projectId]/route.ts`, extend the `modelFieldIssue` `find` predicate at L84–90 to include the 5 `codex*Model` field names so Zod failures on those fields return `INVALID_MODEL_ID` with status 400 (Pattern P5).
8. **Apply-smart-defaults branch** — In `app/api/projects/[projectId]/model-config/apply-smart-defaults/route.ts`, read `project.defaultAgent`, branch into Claude (existing behavior) or Codex (new: `data: { ...CODEX_SMART_DEFAULTS }`, select 5 Codex columns). For MISTRAL/GEMINI return `400 UNSUPPORTED_AGENT_FOR_SMART_DEFAULTS`. Atomic single `prisma.project.update` (Pattern P4). See `workflows/apply-codex-smart-defaults.md` for the reference sketch.
9. **Ticket model-config branch** — In `app/api/projects/[projectId]/tickets/[id]/model-config/route.ts`, detect which agent's keys appear in the body. Reject mixed payloads with `400 MIXED_AGENT_PAYLOAD`. Use `ticketCodexModelOverrideSchema` for Codex payloads. Build `updateData` containing ONLY the active agent's columns (or null both sets for `resetAll`). Return both agent's column sets + `hasAnyOverride` + `overriddenStages` (computed from any non-null column across both sets). See `contracts/ticket-codex-model-override.md`.
10. **Project create seeding** — In `app/api/projects/route.ts` inside the existing creation transaction (~L94–114 per research.md), extend the `prisma.project.create` data block to include `...CODEX_SMART_DEFAULTS` alongside `...SMART_DEFAULTS`. New projects now persist BOTH agent's smart defaults regardless of `defaultAgent` (matches AIB-678 seeding rule, supports later agent switching).

### Phase D — UI extension (Pattern P2 — optimistic update + revert)

11. **AI Models card** — In `components/settings/ai-models-card.tsx`, accept the 5 new `codex*Model` fields on the `project` prop. Add an `isCodex` branch parallel to the existing `isClaude` branch (rendering Codex dropdowns sourced from `CODEX_MODEL_IDS` / `CODEX_MODEL_LABELS` / `CODEX_STAGE_MODEL_KEYS`). Reuse the `FALLBACK_SENTINEL` pattern and the optimistic-update-with-revert handlers verbatim (Pattern P2 at L55–80). For `isClaude || isCodex === false`, keep the existing informational message. Update the smart-defaults handler to send the same POST (the server now branches) and to optimistically set `CODEX_SMART_DEFAULTS` when Codex is active.
12. **Model override dialog** — In `components/tickets/model-override-dialog.tsx`, accept Codex fields in `current` and `onSave`. Branch on `effectiveAgent` to render Claude or Codex dropdowns. The inactive-agent banner remains for MISTRAL/GEMINI. The `PROJECT_DEFAULT_SENTINEL` pattern carries over.
13. **Callers** — Find call sites that construct the `<AIModelsCard project={…} />` and `<ModelOverrideDialog current={…} />` props (in `app/projects/[projectId]/settings/...` and ticket detail pages). Extend the prop objects to include the 5 new `codex*Model` fields from the loaded Project/Ticket rows. Use Grep for `AIModelsCard` and `ModelOverrideDialog` to enumerate sites.

### Phase E — Tests (Constitution §III)

14. **Resolver tests** — In `tests/unit/workflows/model-resolution.test.ts`, add a parallel `describe('resolveStageModel — Codex', …)` block:
    - `.each` over `[specify, plan, implement, quick-impl, verify]` with Codex IDs in ticket/project columns — ticket override wins.
    - Project fallback when ticket is null.
    - Global fallback (`gpt-5.5`) when both layers are null.
    - Non-configurable commands return null.
    - `[Agent.CLAUDE, Agent.MISTRAL, Agent.GEMINI]` with Codex columns set → null.
    - Stale Codex value falls through to project; both stale falls through to fallback.
    - Cross-agent isolation: Claude columns set + `effectiveAgent === CODEX` → resolver returns `CODEX_GLOBAL_FALLBACK_MODEL` (NOT a Claude ID).
15. **Apply-smart-defaults tests** — In `tests/integration/projects/model-config.test.ts`, add a Codex `describe` block: writes 5 `codex*Model` columns when `defaultAgent === CODEX`; idempotent; member can apply; outsider gets 404; MISTRAL/GEMINI project returns 400 `UNSUPPORTED_AGENT_FOR_SMART_DEFAULTS`.
16. **Ticket override tests** — In `tests/integration/tickets/model-override.test.ts`, add Codex `describe` block: single Codex field set; `resetAll: true` clears both column sets; INVALID_MODEL_ID for unknown Codex string; MIXED_AGENT_PAYLOAD when body has both Claude and Codex keys.
17. **Component tests** — Locate existing tests for `AIModelsCard` and `ModelOverrideDialog` via Glob `tests/**/*ai-models-card*.test.tsx` and `tests/**/*model-override-dialog*.test.tsx`. EXTEND existing files with Codex render + interaction cases. Only CREATE new test files if no covering file exists for either component.

### Phase F — Verification

18. **Type-check** — `bun run type-check` must pass clean.
19. **Lint** — `bun run lint` must pass clean.
20. **Unit + integration tests** — `bun run test:unit` and `bun run test:integration` both green; new tests must run AND assertions must execute (no assertions hidden inside conditionals — constitution §III).
21. **Manual smoke** (per CLAUDE.md "For UI or frontend changes"): start dev server, switch a project to `defaultAgent: CODEX`, open settings, confirm Codex dropdowns render, pick `gpt-5.4-mini`, save, dispatch a quick-impl workflow, confirm the Job row shows `model: 'gpt-5.4-mini'`. Switch project back to Claude, confirm Claude columns are still intact (dormancy).

## Testing Strategy

Per constitution §III and the Phase 0 "Existing Files" inventory:

- **Vitest unit tests** — `resolveStageModel` is a pure function; extend `tests/unit/workflows/model-resolution.test.ts`. Constants and `isCodexModelId` are exercised indirectly through resolver tests; no separate unit test needed unless edge-case coverage demands it.
- **Vitest integration tests** — API endpoints (PATCH project, apply-smart-defaults, PATCH ticket model-config) hit the database; extend `tests/integration/projects/model-config.test.ts` and `tests/integration/tickets/model-override.test.ts`. Use existing `getTestContext()` fixtures from `tests/fixtures/vitest/setup`; do NOT create new fixtures.
- **Vitest + RTL component tests** — `AIModelsCard` and `ModelOverrideDialog` have user interactions (dropdowns, save buttons). Use existing `renderWithProviders` helper (`tests/utils/component-test-utils.tsx`). Query priority: `getByRole` > `getByLabelText` > `getByText` > `data-testid`.
- **Playwright E2E** — NOT required. The new flow uses existing screens and patterns already covered by AIB-678's E2E suite (settings card flow). The Codex variant is a UI configuration change, not a new browser-only interaction.

**Test naming and `[e2e]` prefix**: integration tests using `ctx.createTicket()` / `ctx.createProject()` inherit the existing `[e2e]` prefix conventions automatically via the test fixtures. No additional prefix bookkeeping needed.

**Mock discipline**: do NOT mock `prisma` in integration tests — they run against the real test database. Unit tests for the resolver use plain object fixtures (see `EMPTY` constant at `tests/unit/workflows/model-resolution.test.ts:6–19` for the pattern). NEVER mock `lib/models/codex-models.ts` constants — assertions must reference the real values.

## Complexity Tracking

*(Empty — Constitution Check passed with no violations.)*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Post-design Constitution re-check

After completing Phase 1 (research.md, data-model.md, contracts/, workflows/), re-evaluating the gates:

- **TypeScript-First**: All new exports typed (`CodexModelId`, `CodexStageModelKey`, etc.) — **still PASS**.
- **Component-Driven**: No new components; extending existing ones — **still PASS**.
- **TDD**: 3 existing test files identified for extension; component-test paths flagged for verification at implementation time — **still PASS** (no test duplication anticipated).
- **Security-First**: Zod refine on whitelist, existing auth helpers reused, no new public surface — **still PASS**.
- **Database Integrity**: Single migration, all nullable columns, no orphan-risk paths — **still PASS**. Pattern P1 (dispatch-then-rollback) preserved without modification because the resolver's return string is opaque to `transition.ts`.

**Gate result (post-Phase 1)**: PASS. Ready for `/ai-board.tasks` to generate `tasks.md`.
