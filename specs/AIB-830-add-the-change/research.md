# Phase 0 Research — Per-Stage Model Selection for Codex Agent (AIB-830)

**Date**: 2026-05-29
**Status**: Complete (all NEEDS CLARIFICATION resolved)

## Summary

AIB-830 mirrors the existing Claude per-stage model selection feature (AIB-678) for the Codex agent. The entire architecture — schema layout, resolver chain, smart-defaults action, ticket override dialog — is already battle-tested in production for Claude. This research catalogues the existing files that must be modified or paralleled, and extracts the load-bearing patterns that the Codex implementation MUST follow line-for-line so we preserve the same correctness properties (dispatch-then-rollback, optimistic-UI revert, whitelist-driven resolver fall-through, single-transaction smart-defaults write).

There are no remaining unknowns: the spec already auto-resolved every decision (whitelist, smart defaults, fallback, storage strategy, UI surface).

---

## Existing Files (MANDATORY inventory)

### Source files (modify or extend)

| Path | What it covers today | Action for AIB-830 |
|------|----------------------|--------------------|
| `prisma/schema.prisma` (Project L128–132, Ticket L193–197) | Claude per-stage columns: `specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel` (each `String? @db.VarChar(50)`) | **Extend**: add five Codex-prefixed columns to Project and Ticket, identical shape (`codexSpecifyModel`, `codexPlanModel`, `codexImplementModel`, `codexQuickImplModel`, `codexVerifyModel`) |
| `lib/models/claude-models.ts` | `CLAUDE_MODEL_IDS`, `CLAUDE_MODEL_LABELS`, `CLAUDE_GLOBAL_FALLBACK_MODEL`, `STAGE_MODEL_KEYS`, `STAGE_MODEL_LABELS`, `SMART_DEFAULTS`, `isClaudeModelId()`, `commandToStageModelKey()` | **Create parallel file**: `lib/models/codex-models.ts` with `CODEX_MODEL_IDS`, `CODEX_MODEL_LABELS`, `CODEX_GLOBAL_FALLBACK_MODEL`, `CODEX_STAGE_MODEL_KEYS`, `CODEX_STAGE_MODEL_LABELS`, `CODEX_SMART_DEFAULTS`, `isCodexModelId()`. Stage keys and `commandToStageModelKey` already exist for Claude — Codex column names differ (`codex*Model`) so we add `CODEX_STAGE_MODEL_KEYS` and a Codex-specific command→key map |
| `lib/workflows/model-resolution.ts` (L37–61 `resolveStageModel`) | Resolver: ticket → project → `CLAUDE_GLOBAL_FALLBACK_MODEL`. Returns `null` for non-Claude agents (L46–47) | **Extend in same file** (do NOT create new file — keep one resolver surface): add `Agent.CODEX` branch that returns `CodexModelId`. Caller in `transition.ts:182` is unchanged; the resolver decides per-agent. Return union type `ClaudeModelId | CodexModelId | null` |
| `lib/workflows/transition.ts` (L182 resolve, L223+L241 job create, L285+L303+L317 dispatch payload, L365 rollback delete) | Resolves Claude model, writes `model` into Job and into `workflowInputs.model` (conditional spread), deletes Job on dispatch failure | **No code change required** — Job.model column is agent-agnostic; the resolver returning a Codex string flows through unchanged. The conditional spread (`...(resolvedModel && { model: resolvedModel })`) already handles non-null Codex IDs. Only the resolver signature widens; call site stays put |
| `app/lib/schemas/model-config.ts` | `claudeModelIdSchema` (whitelist refine), `ticketModelOverrideSchema` (resetAll + 5 Claude stage fields) | **Extend**: add `codexModelIdSchema` and `ticketCodexModelOverrideSchema` (same refine/refine guards on resetAll, but with `codex*Model` field names) |
| `app/lib/schemas/clarification-policy.ts` | `projectUpdateSchema` includes 5 Claude model fields (L11–15) | **Extend**: add 5 Codex fields with `codexModelIdSchema.nullable().optional()`. The route handler error mapping at `app/api/projects/[projectId]/route.ts:84–95` must also include the Codex field names so Zod failures return `INVALID_MODEL_ID` |
| `app/api/projects/[projectId]/route.ts` (L84–95) | PATCH error mapping checks `['specifyModel', 'planModel', 'implementModel', 'quickImplModel', 'verifyModel']` for `INVALID_MODEL_ID` code | **Extend**: include Codex field names in the same `find` predicate |
| `app/api/projects/[projectId]/model-config/apply-smart-defaults/route.ts` | Writes `SMART_DEFAULTS` (Claude) to project | **Extend in place** (do NOT create a second endpoint): branch on the project's `defaultAgent` — if `CODEX`, write `CODEX_SMART_DEFAULTS` to the five `codex*Model` columns; otherwise existing Claude behavior. Returns the five fields matching the active agent |
| `app/api/projects/[projectId]/tickets/[id]/model-config/route.ts` | PATCH writes Claude per-stage ticket overrides | **Extend in place**: detect which agent's payload arrived (Claude keys vs. Codex keys vs. `resetAll`). Use a single discriminated schema or accept both in one schema and select the right column set via the effective agent context. Reject mixed payloads. `resetAll` clears whichever agent's columns the ticket has populated for now — KEEP CONSERVATIVE: `resetAll` clears BOTH agent column sets (preserves dormancy by leaving values null after reset, not by side-effecting the dormant agent) |
| `components/settings/ai-models-card.tsx` | Renders 5 Claude dropdowns when `defaultAgent === CLAUDE`, otherwise shows informational message | **Extend**: render Codex dropdowns when `defaultAgent === CODEX`. Add `codex*Model` props to component. Reuse the `FALLBACK_SENTINEL` pattern, fallback label, and optimistic-update-with-revert handlers — only the constants imported differ |
| `components/tickets/model-override-dialog.tsx` | Renders dialog with 5 Claude dropdowns when `effectiveAgent === CLAUDE` | **Extend**: render Codex dropdowns when `effectiveAgent === CODEX`. The `PROJECT_DEFAULT_SENTINEL` pattern carries over; `onSave` payload uses Codex field names. Inactive-agent message remains for MISTRAL/GEMINI |
| `lib/db/projects.ts` (referenced by `updateProject`) | Updates project fields | **Verify** that `updateProject` allow-lists fields; if it whitelists, add Codex columns. Otherwise no change |
| `lib/analysis/cost-table.ts` (L22–40 MODEL_PRICING, L42–47 DEFAULT_MODEL_BY_AGENT) | Pricing dictionary already lists `gpt-5.4` and `gpt-5.5`; default for CODEX is `gpt-5.4` | **Extend**: add entries for `gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.2`. Keep `gpt-5.4` and `gpt-5.5` rows. `DEFAULT_MODEL_BY_AGENT.CODEX` stays `gpt-5.4` (consistent with mid-tier average) — orthogonal to the resolver fallback (`gpt-5.5` for dispatch); cost estimate ≠ resolver fallback by design |

### Test files (extend — DO NOT duplicate)

Per constitution §III "Search existing tests FIRST — extend, don't duplicate":

| Path | Today | Action |
|------|-------|--------|
| `tests/unit/workflows/model-resolution.test.ts` | Unit tests for Claude resolver: ticket override wins, project fallback, global fallback, non-configurable command returns null, non-Claude agents return null, stale-value fall-through | **Extend**: add a parallel `describe('resolveStageModel for CODEX', …)` block exercising the same 5 properties on Codex IDs (whitelist hit/miss, ticket→project→fallback chain, non-Codex agent returns null when only Codex columns are set). Add one test confirming Claude columns are ignored when effective agent is Codex (and vice versa) |
| `tests/integration/projects/model-config.test.ts` | Integration tests for `POST /apply-smart-defaults` (Claude) | **Extend**: add tests that, with `defaultAgent === CODEX`, the same endpoint writes `CODEX_SMART_DEFAULTS` to the `codex*Model` columns; idempotency; member authorization; outsider 404 |
| `tests/integration/tickets/model-override.test.ts` | Integration tests for `PATCH /tickets/:id/model-config` (Claude) | **Extend**: add tests for Codex payloads (single field, resetAll, INVALID_MODEL_ID for unknown Codex ID, cross-agent rejection if both Claude and Codex keys arrive in the same body) |
| `tests/integration/projects/[projectId]/route.test.ts` (verify path) | PATCH project tests including model fields | **Extend** if it exists; otherwise add Codex coverage to whichever file currently exercises `PATCH /api/projects/:id` with model fields |
| `tests/unit/components/settings/ai-models-card.test.tsx` (verify path) | RTL tests for AIModelsCard | **Extend** if exists; add `defaultAgent === CODEX` render assertion + interaction test for dropdown selection PATCH call shape |
| `tests/unit/components/tickets/model-override-dialog.test.tsx` (verify path) | RTL tests for dialog | **Extend** if exists; add Codex agent rendering + Codex value PATCH shape |

**Discovery note**: Run a Glob over `tests/**/*.test.{ts,tsx}` with keywords `model-config`, `model-override`, `ai-models-card`, `model-resolution` at implementation time to confirm exact test file paths if any RTL files don't exist yet. New test files are permitted ONLY where the existing inventory has no covering file.

### Spec/historical reference

- `specs/AIB-678-per-stage-model/spec.md`, `plan.md`, `data-model.md`, `research.md`, `contracts/` — the implemented Claude version. The Codex artifacts in this branch should match its structure 1:1.

---

## Patterns to Follow (MANDATORY — concrete file:line references)

### Pattern P1: Dispatch-then-rollback (state management / external-call atomicity)

**Source**: `lib/workflows/transition.ts:214–246, 349–388`
**What it does**:
1. Create Job row with `model: resolvedModel` (Codex string in our case) inside `prisma.$transaction` for quick-impl or a single `prisma.job.create` for other commands.
2. Call `octokit.actions.createWorkflowDispatch()` (L349) with `workflowInputs.model` set via conditional spread (`...(resolvedModel && { model: resolvedModel })`).
3. On `RequestError` from Octokit (L356), `prisma.job.delete({ where: { id: job.id } }).catch(...)` (L365) — no orphaned PENDING rows.

**How it applies to Codex**: The resolver's return value flows directly into both insertion sites. **Do not introduce a separate Job column for "codexModel"** — the existing `Job.model` column is agent-agnostic; the resolved string is the source of truth regardless of agent. The conditional-spread idiom at L285/L303/L317 already protects against null. **No new code path is needed in `transition.ts` for AIB-830** — the resolver alone changes.

### Pattern P2: Optimistic UI with previous-state revert

**Source**: `components/settings/ai-models-card.tsx:55–80, 82–106`
**What it does**:
1. Capture `const previous = state[stage]` (or full state for bulk).
2. `setState` to the new value immediately.
3. `fetch` PATCH; if `!response.ok`, `setState(previous)` and toast `variant: 'destructive'` with title "Previous selection restored. Please try again."
4. Wrap with `isUpdating` boolean for disable state.

**How it applies to Codex**: The Codex card branch must use the same revert pattern with the same toast wording. Power users debugging a failed save expect identical UX between agents. The `router.refresh()` call at L68 must remain so server components re-fetch the new effective state.

### Pattern P3: Whitelist-driven fall-through ("stale value treated as not set")

**Source**: `lib/workflows/model-resolution.ts:50–60`
**What it does**: At each layer, the resolver checks `isClaudeModelId(value)` — a value that exists in storage but is NOT in the current whitelist is treated as `null`. This is what protects projects when OpenAI deprecates an identifier.

**How it applies to Codex**: The Codex resolver branch MUST use `isCodexModelId()` (the parallel guard) and MUST fall through identically. The test in `model-resolution.test.ts:82–98` ("treats a stale ticket value as not set") MUST have a parallel Codex test.

### Pattern P4: Atomic smart-defaults write (single transaction, single round-trip)

**Source**: `app/api/projects/[projectId]/model-config/apply-smart-defaults/route.ts:20–30`
**What it does**: `prisma.project.update({ where: { id }, data: { ...SMART_DEFAULTS }, select: { specifyModel: true, ... } })` — one statement updates and returns all five columns. No `Promise.all`, no per-column update.

**How it applies to Codex**: When `defaultAgent === CODEX`, the same endpoint MUST issue ONE `prisma.project.update` writing `codexSpecifyModel`, `codexPlanModel`, `codexImplementModel`, `codexQuickImplModel`, `codexVerifyModel` to `CODEX_SMART_DEFAULTS` values. No mixing with Claude columns in the same statement. The response shape mirrors the Claude case but with Codex field names.

### Pattern P5: Zod validation with route-level error tagging

**Source**: `app/lib/schemas/model-config.ts:4–6` + `app/api/projects/[projectId]/route.ts:83–95`
**What it does**:
1. `claudeModelIdSchema = z.string().refine(isClaudeModelId, { message: ... })` — refine on the same predicate the resolver uses (single source of truth for what's valid).
2. In the route, `ZodError` handler inspects `issue.path[0]` against a hardcoded set of model field names; if matched, returns `{ error, code: 'INVALID_MODEL_ID', issues }` with status 400; otherwise generic validation error.

**How it applies to Codex**: 
- `codexModelIdSchema = z.string().refine(isCodexModelId, { message: \`Unknown model ID. Allowed: ${CODEX_MODEL_IDS.join(', ')}\` })`.
- The route handler error matcher MUST include the five `codex*Model` field names alongside the Claude ones.

### Pattern P6: Security / authorization parity

**Source**: `apply-smart-defaults/route.ts:18` (`verifyProjectAccess`) and `tickets/[id]/model-config/route.ts:24` (`verifyTicketAccess`)
**What it does**: Owner OR member can read/write project model config; owner OR member (via parent project) can write ticket overrides. Failures surface as 404 for non-members (anti-enumeration), 401 for missing session.

**How it applies to Codex**: Exact same helper calls. **No new authorization helper needed.** The Codex path inherits the existing access control unchanged.

### Pattern P7: Cross-agent dormancy (preserving the AIB-678 contract)

**Source**: spec FR-004 + `components/tickets/model-override-dialog.tsx:131–139` (inactive-agent message)
**What it does**: Claude per-stage columns persist across agent switches; they are simply ignored when `effectiveAgent !== CLAUDE`. The dialog shows a banner explaining "values stored here are preserved but inactive until the agent is switched back to Claude."

**How it applies to Codex**: Storing Codex columns in DEDICATED columns (not reusing Claude columns) preserves this property symmetrically. Switching CLAUDE→CODEX leaves Claude columns untouched (dormant); switching CODEX→CLAUDE leaves Codex columns untouched. The inactive-agent banner is rendered for whichever agent is NOT the current effective one when that agent has stored values.

---

## Decisions (all NEEDS CLARIFICATION resolved by spec auto-resolution)

### D1 — Codex model whitelist

- **Decision**: `CODEX_MODEL_IDS = ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.2'] as const`
- **Rationale**: Verified against OpenAI Codex CLI docs (developers.openai.com/codex/models) and openai/codex GitHub repo. These are the exact strings the CLI accepts via `--model`. `gpt-5.3-codex-spark` excluded (ChatGPT-Pro-only research preview, not generally API-available).
- **Alternatives considered**:
  - **Open-ended free-text input** — rejected; UI parity with Claude requires a curated dropdown, and a free-text field would allow invalid IDs to reach the workflow and fail at dispatch time with a confusing error.
  - **Auto-discover from OpenAI's `/v1/models` endpoint** — rejected; adds runtime dependency and network latency, doesn't filter to coding-relevant models, and changes the list silently without review.

### D2 — Storage strategy

- **Decision**: Dedicated `codex*Model` columns on both Project and Ticket, parallel to the existing `*Model` (Claude) columns.
- **Rationale**: Preserves the dormancy contract (Pattern P7). Reusing the existing columns would require either destroying Claude config on agent switch or interpreting the same stored string differently based on a sibling column — both fragile.
- **Alternatives considered**:
  - **Single JSON column `modelConfig: { claude: {...}, codex: {...} }`** — rejected; loses Postgres column-level constraints, complicates Prisma queries, breaks parity with the Claude implementation's straight-column model. Storage cost is negligible (5 VarChar(50) per row, all nullable).
  - **Reuse the `*Model` columns + a `modelConfigAgent` discriminator** — rejected; cannot store both agents' configs simultaneously, defeats dormancy.

### D3 — Resolver shape

- **Decision**: Extend the existing `resolveStageModel()` in `lib/workflows/model-resolution.ts` to branch on `effectiveAgent` — Claude returns `ClaudeModelId`, Codex returns `CodexModelId`, others return `null`. Return type widens to `ClaudeModelId | CodexModelId | null`.
- **Rationale**: One resolver entry point keeps the dispatch site (`transition.ts:182`) untouched and protects against drift between two parallel resolvers. The branch is a single conditional.
- **Alternatives considered**:
  - **Two separate resolvers (`resolveClaudeStageModel`, `resolveCodexStageModel`)** — rejected; pushes branching logic into the caller, creates two places to maintain the priority chain, easy to forget to update both when the chain changes.

### D4 — Codex global fallback

- **Decision**: `CODEX_GLOBAL_FALLBACK_MODEL = 'gpt-5.5'`
- **Rationale**: Official Codex docs recommend `gpt-5.5` as default for general coding. Matches Claude's "safest available frontier model as fallback" posture (Opus 4.7).
- **Alternatives considered**: `gpt-5.4` — rejected as not the documented default.

### D5 — Codex smart defaults

- **Decision**:
  ```
  codexSpecifyModel:    gpt-5.5
  codexPlanModel:       gpt-5.5
  codexImplementModel:  gpt-5.4
  codexQuickImplModel:  gpt-5.4-mini
  codexVerifyModel:     gpt-5.4-mini
  ```
- **Rationale**: Mirrors Claude's "frontier on reasoning stages / flagship on implementation / fast on quick+verify" split. SPECIFY+PLAN need maximum reasoning; IMPLEMENT needs strong-but-cost-aware coding; QUICK-IMPL+VERIFY are short and high-volume → fast variant.
- **Alternatives considered**: All five = `gpt-5.5` — rejected as cost-unaware default.

### D6 — UI surface

- **Decision**: Extend existing `AIModelsCard` and `ModelOverrideDialog` components rather than creating Codex-only surfaces.
- **Rationale**: Single agent-aware card matches users' mental model; switching projects between agents should not show a different settings layout, only different model identifiers.
- **Alternatives considered**: Separate `CodexModelsCard` — rejected (component duplication, drifts from Claude card over time).

### D7 — Apply-smart-defaults endpoint behavior

- **Decision**: Endpoint inspects `project.defaultAgent` and writes the matching agent's smart defaults to that agent's columns only. If `defaultAgent` is neither CLAUDE nor CODEX, return `400 Bad Request` with code `UNSUPPORTED_AGENT_FOR_SMART_DEFAULTS`.
- **Rationale**: One endpoint, deterministic behavior, no client guesswork. Idempotent within an agent.
- **Alternatives considered**: Always write both agents' smart defaults — rejected; would silently overwrite the dormant agent's intentional configuration.

### D8 — Ticket override `resetAll` semantics

- **Decision**: `resetAll: true` on the ticket model-config endpoint clears BOTH Claude AND Codex per-stage columns on the ticket.
- **Rationale**: User intent of "reset all to project defaults" is agent-agnostic. Clearing only the active agent's columns would surprise users who switched agents mid-ticket and now want a clean slate.
- **Alternatives considered**: Reset only active-agent columns — rejected; leaves dormant-agent overrides in place, contradicts the "reset all" label.

### D9 — Cost-table extension

- **Decision**: Add `gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.2` rows to `MODEL_PRICING` in `lib/analysis/cost-table.ts`. `DEFAULT_MODEL_BY_AGENT.CODEX` stays at `gpt-5.4`.
- **Rationale**: Resolver fallback (`gpt-5.5`) is what's dispatched when no config is set; cost-table default is the "neutral" assumption for analysis cost estimates — they serve different purposes and need not be the same value. Documenting this divergence here so future maintainers don't conflate them.
- **Source for prices**: Public OpenAI pricing as of 2026-05-29; mirrors the conservative pattern of the existing rows (lower-tier minis approximately 20–25% of flagship cost).

---

## Glossary (for downstream tasks.md)

- **Codex stage column**: one of `codexSpecifyModel | codexPlanModel | codexImplementModel | codexQuickImplModel | codexVerifyModel` on either `Project` or `Ticket`.
- **Codex resolver branch**: the new conditional inside `resolveStageModel()` that fires when `effectiveAgent === Agent.CODEX`.
- **Codex SMART_DEFAULTS**: the constant in `lib/models/codex-models.ts` consumed by `apply-smart-defaults`.

## Out of scope (explicitly)

- Adding per-stage model selection for MISTRAL or GEMINI. The Codex-only design follows the spec; future agents will require their own ticket.
- Changing `Job.model` column shape. It already stores arbitrary model identifiers and is agent-agnostic.
- Re-pricing existing Codex models. Only adding new pricing rows for newly-whitelisted Codex models.
