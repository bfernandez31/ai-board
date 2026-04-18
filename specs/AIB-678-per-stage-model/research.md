# Research: Per-Stage Model Configuration for Claude Workflows (AIB-678)

**Date**: 2026-04-18
**Branch**: `AIB-678-per-stage-model`

## Decisions

### Decision 1: Storage shape for project-level per-stage model config

- **Decision**: Add five nullable columns on `Project` — `specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel` — each `String? @db.VarChar(50)`. Null means "no explicit value" (resolves to global Opus 4.7 fallback).
- **Rationale**:
  - Matches the existing per-project column-based pattern used for `defaultAgent`, `clarificationPolicy`, `defaultBranch` — keeps reads via Prisma `select` cheap and typed.
  - Fixed slot count (5) means normalization into a child table adds rows-per-project without reuse benefit.
  - Nullable columns let existing projects (pre-migration) resolve to Opus 4.7 on every stage automatically (FR-007), without a data-backfill migration.
  - New projects are seeded at creation time inside the existing `prisma.$transaction` in `app/api/projects/route.ts` so smart defaults are part of the creation contract (FR-006).
- **Alternatives considered**:
  - `ProjectModelConfig` child table (1:1 with Project): rejected — adds a join for every dispatch, and all five fields have the same lifecycle.
  - Single `Json?` map column: rejected — forfeits Prisma column-level typing and complicates Zod schema alignment with the database (constitution IV rule: "Zod schema constraints MUST match corresponding database column constraints").
  - Enum of model IDs instead of VarChar: rejected — the existing `Job.model` field is already `String? @db.VarChar(50)`. Using the same type keeps the `Job.model` writeback path trivial and avoids a new enum that would require a migration every time the whitelist expands.

### Decision 2: Storage shape for ticket-level per-stage override

- **Decision**: Add five nullable columns on `Ticket` — `specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel` — each `String? @db.VarChar(50)`. Null means "inherit from project default" (FR-009 explicit semantics).
- **Rationale**:
  - Mirrors the project-level storage and the existing `Ticket.agent` / `Ticket.clarificationPolicy` override pattern (both `@db.VarChar` / nullable enums).
  - No physical record when no overrides → schema allows "no override" to be encoded as all-null, satisfying "A ticket with no overrides at all MAY have no physical record" (data-model hint in spec).
  - "Inherit" tracks the project default live (Auto-Resolved Decision #2) because null is resolved at dispatch time, not frozen at write time.
- **Alternatives considered**:
  - `TicketModelOverride` child table: rejected — same reasoning as project; fixed slot count.
  - Sentinel value `"INHERIT"` instead of null: rejected — null already means "no override" for `Ticket.agent` and `Ticket.clarificationPolicy`; consistency wins.

### Decision 3: Whitelist representation

- **Decision**: Code-owned constant `CLAUDE_MODEL_WHITELIST` in a new module `lib/models/claude-models.ts`, exporting:
  - `CLAUDE_MODEL_IDS`: `readonly ['claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']`
  - `ClaudeModelId` type derived from the above
  - `CLAUDE_MODEL_LABELS`: `Record<ClaudeModelId, string>` for UI
  - `CLAUDE_GLOBAL_FALLBACK_MODEL: ClaudeModelId = 'claude-opus-4-7'`
  - `SMART_DEFAULTS: Record<StageKey, ClaudeModelId>` where StageKey = `'specify' | 'plan' | 'implement' | 'quickImpl' | 'verify'`
  - `isClaudeModelId(value: unknown): value is ClaudeModelId` type guard for Zod `.refine()`
- **Rationale**:
  - Model IDs match the existing Anthropic SDK convention already referenced in CLAUDE.md system context ("claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"). Opus 4.7 ID uses the same short form to match the fallback already emitted by the existing workflow layer.
  - Single source of truth for both Zod validation (FR-002, FR-019) and Select dropdown options (FR-003, FR-010).
  - Closed set + validation-on-write protects dispatch (Auto-Resolved Decision #3, "no silent coercion").
- **Alternatives considered**:
  - Database-backed whitelist: rejected — the ticket explicitly calls the whitelist "Closed, code-owned". A runtime registry adds complexity with no use case today.
  - Prisma enum: rejected — enum changes require migrations, and the whitelist naturally expands as Anthropic ships new models.

### Decision 4: Resolution algorithm and integration point

- **Decision**: New pure function `resolveStageModel(ticket, command)` in `lib/workflows/model-resolution.ts`:
  1. If `command` is not one of the 5 configurable stages, return `null` (no model override sent — preserves FR-017).
  2. Resolve effective agent via existing `resolveEffectiveAgent(ticket)` in `lib/workflows/transition.ts:58`.
  3. If effective agent is not `Agent.CLAUDE`, return `null` (FR-015; stored Claude overrides ignored but not deleted).
  4. Read ticket override column for the stage. If non-null and in whitelist → return it.
  5. Read project column for the stage. If non-null and in whitelist → return it.
  6. Fall through to `CLAUDE_GLOBAL_FALLBACK_MODEL` (FR-014, FR-007).
  7. Stale stored values (non-whitelisted) are treated as "not set" so resolution continues to the next layer (spec Edge Case: "Model removed from whitelist").
- **Integration point**: Call `resolveStageModel()` inside `handleTicketTransition()` in `lib/workflows/transition.ts` immediately after `resolveEffectiveAgent` (line 180) and before `prisma.job.create`. Pass the resolved model as the Job's `model` field on creation (FR-016) and include it in `workflowInputs.model` for the three dispatch branches (quick-impl @ L274-282, verify @ L290-299, standard @ L303-312).
- **Rationale**:
  - Keeps resolution logic pure and independently unit-testable (constitution III: "Is it a pure function... → Vitest unit test").
  - Follows the existing pattern where `ticket.clarificationPolicy ?? ticket.project.clarificationPolicy` is resolved inline at dispatch time (transition.ts:315).
  - Setting `Job.model` at creation time means analytics (SC-001) are accurate even if the workflow later fails to report telemetry — the dispatched model is recorded the moment the job row exists.
- **Alternatives considered**:
  - Resolve inside GitHub workflow YAML: rejected — workflows don't have DB access; app-side resolution is the only place that sees both project + ticket state with a live Prisma session.
  - Write resolved model back to Job only on workflow completion: rejected — breaks SC-001 if workflow fails before reporting.

### Decision 5: Workflow input key name

- **Decision**: Add `model` to the `workflowInputs` payload passed to `octokit.actions.createWorkflowDispatch()`. Emit the field only when `resolveStageModel()` returns a non-null value (i.e., when agent is Claude).
- **Rationale**:
  - `Job.model` is already named `model`; matching the key minimizes cognitive overhead.
  - Omitting the field when null means non-Claude workflow files don't need to handle a dormant input (FR-015); GitHub Actions accepts missing optional inputs.
  - The three downstream workflow YAMLs (`speckit.yml`, `quick-impl.yml`, `verify.yml`) need a matching optional `model` input added so the agent invocation script can pick it up. The app-level change is self-contained and backward-compatible: if the workflow YAMLs are updated in the same PR, Claude workflows accept the new input; if a workflow hasn't been updated yet, the unused input is silently ignored by `workflow_dispatch`.
- **Alternatives considered**:
  - `claudeModel` key: rejected — redundant given non-Claude dispatches won't receive it anyway.

### Decision 6: Non-Claude agent behavior for dormant config

- **Decision**: Storage is preserved when agent switches away from Claude; resolution function returns `null` early when effective agent is not Claude; UI shows informational message instead of selectors (FR-004, FR-012) and "Custom models" badge on ticket card remains visible but uses a muted style + tooltip suffix "(dormant — agent is {Agent})" (FR-021).
- **Rationale**:
  - Explicit in spec and Auto-Resolved Decisions #4 and #6.
  - Preserves user intent across agent swaps (SC-010).
- **Alternatives considered**:
  - Delete stored Claude config on agent switch: rejected — loses data (SC-010 failure).
  - Hide the badge entirely when agent is non-Claude: rejected — Auto-Resolved Decision #6 prefers transparency; muted tooltip wins.

### Decision 7: Migration strategy for existing projects

- **Decision**: Prisma migration adds the 10 new columns (5 on Project, 5 on Ticket) all as `String? @db.VarChar(50)` with no default. No data backfill. Existing Project rows get `NULL` on every new column → resolution falls through to `CLAUDE_GLOBAL_FALLBACK_MODEL` → byte-identical behavior to today (FR-007, SC-003).
- **Rationale**:
  - "Migration MUST NOT change any project's dispatch behavior" (FR-007).
  - Backfilling with explicit "claude-opus-4-7" would work but offers no behavioral difference and makes the "has this project been configured?" query noisier. Null is the cleanest encoding of "never touched".
- **Alternatives considered**:
  - Backfill existing projects with explicit `claude-opus-4-7` on all 5 stages: rejected — no behavior difference and creates ambiguity between "owner picked Opus 4.7" vs "migration set it".
  - Backfill only new projects via application-layer seeding: adopted (for NEW projects only — see Decision 1). Existing projects remain null-seeded.

### Decision 8: Opt-in smart defaults action

- **Decision**: New endpoint `POST /api/projects/:projectId/model-config/apply-smart-defaults` that atomically overwrites all 5 project columns with `SMART_DEFAULTS` values. Uses existing `verifyProjectAccess` (owner OR member per FR-018). Returns the updated project-level model config.
- **Rationale**:
  - FR-008 describes a one-click owner action.
  - Dedicated endpoint (vs extending PATCH) makes the atomic-5-column overwrite semantics explicit and testable.
- **Alternatives considered**:
  - Reuse PATCH `/api/projects/:id` with `{ specifyModel: ..., planModel: ..., ... }`: possible but less discoverable and UI would need to hardcode the same defaults; having a single endpoint keeps the default set centralized in `lib/models/claude-models.ts`.

### Decision 9: "Custom models" badge trigger rule

- **Decision**: Badge shows when `ticket.specifyModel || ticket.planModel || ticket.implementModel || ticket.quickImplModel || ticket.verifyModel` is non-null. Tooltip enumerates which stages are overridden. When effective agent is non-Claude, badge uses muted variant and tooltip suffix notes the dormant state.
- **Rationale**:
  - Matches Auto-Resolved Decision #6 exactly.
  - Ticket card can derive badge visibility from the five columns already selected on the ticket — no extra query.

### Decision 10: Unit of retry — per-dispatch resolution

- **Decision**: Every retry / manual re-dispatch re-runs `resolveStageModel()` at the moment of dispatch. Original Job records are never modified.
- **Rationale**:
  - Spec Edge Case: "A job failed, then the owner changed the project default, then the job is retried. The retry resolves the model again at dispatch time (takes the new default) — the original Job record still shows the previously used model."
  - Matches existing behavior where `resolveEffectiveAgent` is re-evaluated on every call to `handleTicketTransition`.

---

## Existing Files

### Database schema

- **`prisma/schema.prisma`** — **EXTEND**
  - `Job` model (L29–68): `model` field already exists at L53 as `String? @db.VarChar(50)`. No change needed to schema — dispatch will populate it (today it's populated post-dispatch by telemetry only).
  - `Project` model (L70–99): add `specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel` — all `String? @db.VarChar(50)` nullable, no default. Place after `defaultBranch` (L85) to group with other config columns.
  - `Ticket` model (L125–159): add the same 5 columns. Place after `agent` (L142) to group with existing override columns.

### Project-level UI (Settings page)

- **`components/settings/clarification-policy-card.tsx`** — **Pattern reference (Decision 4 / FR-003)**. This is the exact template for the new card: Prisma enum select, optimistic update via `fetch PATCH /api/projects/{id}`, revert on error, `router.refresh()`, aurora styling.
- **`components/settings/default-agent-card.tsx`** — **Pattern reference**. Shows how to iterate over an enum (`Object.values(Agent)`) and render an AgentIcon per item; model card will do the same over `CLAUDE_MODEL_IDS`.
- **`app/settings/[projectId]/page.tsx`** or similar — **EXTEND** to render the new `<AIModelsCard />` alongside the existing clarification policy / default agent cards. (Confirm exact path during implementation — settings page was not re-read in this phase but it imports both referenced cards today.)
- **`components/settings/ai-models-card.tsx`** — **CREATE**. New card with 5 stage rows; each row is a Select over the 4 whitelisted models. Uses `project.defaultAgent` to decide between "render 5 selectors" and "render informational message" (FR-004). Includes the "Apply smart defaults" action (FR-008) when any of the 5 columns is null or a non-smart-default value.

### Ticket-level UI (override dialog + badge)

- **`components/tickets/agent-edit-dialog.tsx`** — **Pattern reference (Decision 4 / FR-010)**. New dialog mirrors this component exactly: Dialog shell, "Current status" summary, Select per row with "Inherit from project default" as first option, error display, save/cancel footer.
- **`components/tickets/model-override-dialog.tsx`** — **CREATE**. Contains 5 selector rows plus a "Reset all to project defaults" button (FR-011). Shows informational-message fallback when ticket's effective agent is not Claude (FR-012). Calls a new endpoint (see contracts/) instead of reusing the generic ticket PATCH — matches the dedicated "apply smart defaults" pattern and simplifies Zod validation for 5 at-once fields.
- **`components/board/ticket-card.tsx`** (L160–172) — **EXTEND**. Agent badge block is the insertion point for the new "Custom models" badge (FR-020, FR-021). Add immediately after the existing agent badge so both render side-by-side.

### Workflow dispatch

- **`lib/workflows/transition.ts`** — **EXTEND**
  - L58 `resolveEffectiveAgent` — keep unchanged; `resolveStageModel` consumes it.
  - L180 — after computing `effectiveAgent`, compute `resolvedModel = resolveStageModel(ticket, command)`.
  - L214–241 — pass `model: resolvedModel` into both `prisma.job.create` call sites.
  - L274–282, L290–299, L303–312 — include `...(resolvedModel && { model: resolvedModel })` in each `workflowInputs` object.
  - Error-path at L358–360 (`prisma.job.delete` on GitHub dispatch failure) remains unchanged — the pattern "dispatch-then-rollback" is preserved.
- **`lib/workflows/model-resolution.ts`** — **CREATE**. Pure resolution function per Decision 4.
- **`lib/models/claude-models.ts`** — **CREATE**. Whitelist + labels + smart defaults + type guard per Decision 3.

### API endpoints

- **`app/api/projects/[projectId]/route.ts`** (PATCH) — **EXTEND**. Accept the 5 new fields via an expanded Zod schema; continue using `verifyProjectAccess` for owner-or-member auth (FR-018).
- **`app/api/projects/[projectId]/model-config/apply-smart-defaults/route.ts`** — **CREATE** (POST). Atomic overwrite of the 5 columns with `SMART_DEFAULTS` (FR-008).
- **`app/api/projects/[projectId]/tickets/[id]/model-config/route.ts`** — **CREATE** (PATCH). Accept the 5 nullable fields for ticket overrides; uses `verifyTicketAccess`; supports full-reset semantics (FR-011) when caller sends `{ specifyModel: null, planModel: null, ... }` or a dedicated `{ reset: true }` flag.
- **`app/api/projects/route.ts`** (POST, L94–114) — **EXTEND**. Inside the existing `prisma.$transaction`, inject `SMART_DEFAULTS` values into the `prisma.project.create` data block. This is the "Project creation seed" internal process (FR-006).

### Validation schemas

- **`app/lib/schemas/clarification-policy.ts`** — **EXTEND**. Extend `projectUpdateSchema` with optional `specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel`, each validated by `z.string().refine(isClaudeModelId)` (FR-002). (This file already contains all project PATCH fields; keeping them together avoids scatter.)
- **`lib/validations/ticket.ts`** — **EXTEND** `patchTicketSchema` OR leave it untouched and use the dedicated `/model-config` endpoint. Preferred: dedicated endpoint (see Decision in contracts/) to keep PATCH lean.
- **`app/lib/schemas/model-config.ts`** — **CREATE**. New Zod module for the two dedicated model-config endpoints (project smart-defaults response, ticket override payload).

### Authorization helpers

- **`lib/db/auth-helpers.ts`** — **Reuse as-is**
  - `verifyProjectAccess(projectId, request?)` — use for all project-level model config reads/writes (FR-018: owner or member).
  - `verifyTicketAccess(ticketId, request?)` — use for ticket-level model override reads/writes.
  - Neither helper needs modification.

### Agent / model utilities

- **`app/lib/utils/agent-resolution.ts`** — **Reuse**. `supportsWorkflowCommand`, `resolveEffectiveAgent`, `AGENT_LABELS` continue to be authoritative for agent concerns.
- **`app/lib/utils/agent-icons.ts`** — **Reuse**. `AgentIcon`, `getAgentLabel`, `getAgentDescription` used in both the settings card (informational-message branch) and the override dialog.

### Existing tests (extend, don't duplicate)

- **`tests/integration/projects/settings.test.ts`** — **EXTEND** with per-stage model PATCH cases (happy path per stage, whitelist rejection, isolation between the 5 fields, persistence, non-owner-non-member rejection). Mirrors existing `defaultAgent` PATCH tests.
- **`tests/unit/components/clarification-policy-card.test.tsx`** (discovered during Phase 0 — if present under `tests/unit/components/`) — **Pattern reference** for the new `ai-models-card.test.tsx`.
- **`tests/unit/components/default-agent-card.test.tsx`** — **Pattern reference** for rendering the informational-message branch (FR-004).
- **`tests/unit/components/agent-edit-dialog.test.tsx`** — **Pattern reference** for the new `model-override-dialog.test.tsx`.
- **`tests/integration/tickets/transitions.test.ts`** — **EXTEND**. Already covers INBOX→SPECIFY and quick-impl job creation; extend to verify that the created job's `model` field carries the resolved model, that `workflowInputs.model` is sent, and that dormant config (agent=Gemini) does not emit a model input.
- **`tests/integration/projects/crud.test.ts`** — **EXTEND**. Verify new projects are created with `SMART_DEFAULTS` persisted on the 5 columns (SC-004).
- **`tests/unit/workflows/model-resolution.test.ts`** — **CREATE**. Pure-function unit tests for the 4-layer resolution chain, dormant-when-non-Claude, unknown stored value fallthrough.
- **`tests/unit/components/ai-models-card.test.tsx`** — **CREATE**. Card rendering for Claude vs non-Claude, smart-default apply button visibility, optimistic update + revert.
- **`tests/unit/components/model-override-dialog.test.tsx`** — **CREATE**. Dialog rendering for 5 rows, "Reset all" button, Claude-vs-non-Claude branch, save flow.
- **`tests/unit/components/ticket-card.test.tsx`** (if present — verify in Phase 2) — **EXTEND** to cover "Custom models" badge visibility and dormant-style variant.
- **`tests/integration/projects/model-config.test.ts`** — **CREATE**. End-to-end for the `/api/projects/:id/model-config/apply-smart-defaults` endpoint (auth, idempotency, correctness of values persisted).
- **`tests/integration/tickets/model-override.test.ts`** — **CREATE**. End-to-end for the new ticket model-config PATCH (auth, reset semantics, whitelist rejection, preservation across agent switch).

---

## Patterns to Follow

### Pattern P1: Dispatch-then-rollback on GitHub failure

**Source**: `lib/workflows/transition.ts:212–242` (Job created first) and `:358–360` (`prisma.job.delete` when `octokit.actions.createWorkflowDispatch` throws `RequestError`).

**Rule to apply**: When extending `handleTicketTransition` to include `model` in the Job creation and in `workflowInputs`, we MUST NOT change the order of operations. The Job row is still created before the GitHub dispatch call. On dispatch failure, the existing rollback (`prisma.job.delete`) still cleans up. This means the newly-set `Job.model` is deleted alongside the row — no orphaned model record.

**Example**:
```ts
// transition.ts:180 (extend immediately below)
const effectiveAgent = resolveEffectiveAgent(ticket);
const resolvedModel = resolveStageModel(ticket, command, effectiveAgent);
// ... then later, at the job.create sites (L216, L233):
data: {
  ticketId: ticket.id,
  projectId: ticket.projectId,
  command,
  status: JobStatus.PENDING,
  model: resolvedModel, // ← new; null when agent is not Claude
  startedAt: new Date(),
  updatedAt: new Date(),
},
```

### Pattern P2: Optimistic update with revert-on-error

**Source**: `components/settings/clarification-policy-card.tsx:30–52` — `setPolicy(newPolicy)` is called only after the PATCH succeeds; `setPolicy(project.clarificationPolicy)` reverts on error; `router.refresh()` revalidates server components.

**Rule to apply**: The new AI Models card and Model Override Dialog MUST follow the same pattern: PATCH first, update local state on success, revert on error, refresh to sync other server components (ticket list cards, etc.). This satisfies SC-007 (200 ms reflect + revert-on-error).

### Pattern P3: "Inherit from project default" via null sentinel

**Source**: `components/tickets/agent-edit-dialog.tsx:49–51, 68–73` — dialog uses the string `'project-default'` as the SelectItem value for "inherit" and maps it to `null` on save (`agentValue = selectedAgent === 'project-default' ? null : selectedAgent as Agent`).

**Rule to apply**: Each of the 5 rows in the new `ModelOverrideDialog` MUST use the same string sentinel approach. Mapping the sentinel to `null` at save time is what persists "no value" in the new ticket columns — which is the encoding that makes the project default live (Auto-Resolved Decision #2).

### Pattern P4: Database-backed whitelist validation via Zod `.refine`

**Source**: `lib/validations/ticket.ts:122–123` uses `z.nativeEnum(Agent)` + `.nullable().optional()`. For whitelist values that are NOT a Prisma enum (our case — model IDs are strings), the project uses `z.string().refine()` patterns (e.g., `titleSchema` uses `.regex`).

**Rule to apply**: Create `claudeModelIdSchema = z.string().refine(isClaudeModelId, { message: 'Unknown model ID. Allowed: {list}' })` in `lib/models/claude-models.ts` and reuse it everywhere the 5 new fields are validated. This enforces FR-002 / FR-019 with a single source of truth.

### Pattern P5: Atomic transaction on project creation

**Source**: `app/api/projects/route.ts:94–114` wraps quota check + project create in `prisma.$transaction`.

**Rule to apply**: Smart-defaults seeding MUST be part of the same transaction — same block, no separate update call. This matches the spec's "Project creation seed" internal process: "Failure MUST abort project creation (project is not partially created) since the seed is part of the creation transaction."

### Pattern P6: Resolve-at-dispatch, not frozen-on-save

**Source**: `lib/workflows/transition.ts:315` — `const effectivePolicy = ticket.clarificationPolicy ?? ticket.project.clarificationPolicy;` — both values are read fresh at dispatch time, not snapshotted when the ticket was created.

**Rule to apply**: `resolveStageModel(ticket, command)` MUST read `ticket.*Model` and `ticket.project.*Model` from the `ticket` passed in (which is fresh from DB at the transition API boundary). No caching, no pre-computed columns.

### Pattern P7: Authorization via `verifyProjectAccess` / `verifyTicketAccess`

**Source**: `lib/db/auth-helpers.ts` — both helpers reject non-owner non-members with "Project not found" / "Ticket not found" semantics.

**Rule to apply**: Both new endpoints and the extended PATCH routes MUST call `verifyProjectAccess(projectId, request)` (or the ticket equivalent) as the first line. Never introduce a new auth shape (FR-018: "same authorization rules as the existing agent edit action"). Owner-only (`verifyProjectOwnership`) is explicitly NOT used — this matches the ticket language "project owner or member".

### Pattern P8: Error shape — structured `{ error, code? }`

**Source**: Constitution "Error Handling" + ticket & project routes consistently return `{ error: 'message', code: 'SOME_CODE' }` with appropriate 4xx status.

**Rule to apply**: Whitelist rejection responses MUST use a code like `INVALID_MODEL_ID` with the actionable list of allowed IDs in the message (Auto-Resolved Decision #3 Reviewer Note). Auth rejections return 401/403 structured responses, never 500.

---

## Open Questions / Follow-ups (none block Phase 1)

- **Confirm the exact Settings page file** (e.g., `app/settings/[projectId]/page.tsx` vs `app/projects/[projectId]/settings/page.tsx`) during the tasks phase — only affects where the new card is mounted, not the design.
- **Ticket card test coverage**: if `tests/unit/components/ticket-card.test.tsx` does not already exist, the "Custom models" badge test can live in a new or existing board tests file — tasks will decide based on the real layout.
- **Workflow YAML updates**: `.github/workflows/speckit.yml`, `quick-impl.yml`, `verify.yml` need an optional `model` input and a forwarding step into the agent invocation. This is tactically part of the same change but lives outside `target/` — flag in tasks.md as a coordinated cross-repo update if required.
