# Research: Pass Agent Selection Through Workflow Dispatch Pipeline

**Branch**: `AIB-230-pass-agent-selection` | **Date**: 2026-03-05

## Research Task 1: GitHub Actions 10-Input Limit Strategy

**Decision**: Use a mixed approach — embed agent in existing JSON payloads for workflows at/near the 10-input limit, add as discrete input for workflows with headroom.

**Rationale**:
- `speckit.yml` currently has 9 inputs. Adding a 10th discrete `agent` input is possible (GitHub allows exactly 10). However, the spec mandates embedding in `specifyPayload` JSON to keep the input count stable for future additions.
- `ai-board-assist.yml` currently has 9 inputs. Adding a 10th `agent` input is feasible and keeps parsing simple.
- All other workflows (quick-impl, verify, cleanup, iterate) have 4-6 inputs with ample room for a discrete `agent` input.
- The `specifyPayload` and `quickImplPayload` already bundle multiple values as JSON — adding `agent` to them is consistent with their design.

**Alternatives Considered**:
1. **All discrete inputs**: Would push speckit.yml to 10 inputs. Viable now but leaves no room for future inputs. Rejected.
2. **All embedded in JSON**: Would require adding JSON payloads to workflows that currently use discrete inputs (verify, cleanup, iterate). Unnecessary complexity. Rejected.
3. **Mixed approach (chosen)**: Embed in existing payloads where they exist, discrete where they don't. Natural fit.

## Research Task 2: Agent Resolution Logic Pattern

**Decision**: Create a reusable `resolveEffectiveAgent()` utility function in `lib/workflows/transition.ts`.

**Rationale**:
- The resolution chain is: `ticket.agent ?? ticket.project.defaultAgent ?? Agent.CLAUDE`
- This pattern already exists for `clarificationPolicy` (line 250 of transition.ts): `ticket.clarificationPolicy ?? ticket.project.clarificationPolicy`
- A standalone function keeps the logic DRY across transition.ts and the 3 other dispatch helpers (dispatch-ai-board.ts, cleanup route, iterate — wherever the iterate dispatch occurs)
- The system-wide fallback to `CLAUDE` matches the Prisma schema default (`@default(CLAUDE)` on `Project.defaultAgent`)

**Alternatives Considered**:
1. **Inline resolution at each call site**: Simple but repeats logic in 5+ places. Rejected due to DRY violation.
2. **Database-level computed field**: Prisma doesn't support computed fields. Rejected.
3. **Utility function (chosen)**: Single source of truth, testable, matches existing patterns.

## Research Task 3: Workflow YAML Changes Required

**Decision**: Add `agent` input to all agent-invoking workflows. Non-agent-invoking workflows (rollback-reset, deploy-preview) are excluded.

**Rationale**:
- **Workflows that invoke agent CLIs** (need `agent` input): speckit.yml, quick-impl.yml, verify.yml, cleanup.yml, ai-board-assist.yml, iterate.yml
- **Workflows that don't invoke agent CLIs** (skip): rollback-reset.yml (git operations only), deploy-preview.yml (Vercel deployment only)
- Per spec FR-002 through FR-007, all agent-invoking workflows must receive the agent value

**Input count after changes**:
| Workflow | Current Inputs | After Change | Strategy |
|----------|---------------|--------------|----------|
| speckit.yml | 9 | 9 (embedded in specifyPayload JSON) | Embed in payload |
| quick-impl.yml | 6 | 6 (embedded in quickImplPayload JSON) | Embed in payload |
| verify.yml | 6 | 7 | Discrete input |
| cleanup.yml | 4 | 5 | Discrete input |
| ai-board-assist.yml | 9 | 10 | Discrete input |
| iterate.yml | 6 | 7 | Discrete input |

## Research Task 4: Iterate Workflow Dispatch Location

**Decision**: The iterate workflow is dispatched from within the verify workflow YAML itself (not from the app TypeScript code).

**Rationale**:
- No TypeScript dispatch function exists for iterate — searched `app/` directory with no results
- The iterate workflow is triggered during VERIFY stage execution when the AI agent detects fixable issues
- This means the agent value must be available within the verify workflow context and passed forward when iterate is dispatched
- The verify workflow must capture the `agent` input and pass it to iterate via `gh workflow run iterate.yml`

**Implications**:
- The verify.yml workflow must accept `agent` as an input AND pass it when dispatching iterate.yml
- This is a workflow-to-workflow propagation, not app-to-workflow

## Research Task 5: Dispatch Helper Functions to Modify

**Decision**: Modify all dispatch helpers that invoke agent CLIs to accept and pass the `agent` parameter.

**Files requiring changes**:
1. `lib/workflows/transition.ts` — Main dispatch (speckit.yml, quick-impl.yml, verify.yml)
2. `app/lib/workflows/dispatch-ai-board.ts` — AI-BOARD assist dispatch
3. `app/api/projects/[projectId]/clean/route.ts` — Cleanup dispatch (inline, not a helper)
4. `.github/workflows/verify.yml` — Iterate dispatch (workflow-to-workflow)

**Files NOT requiring changes**:
- `app/lib/workflows/dispatch-rollback-reset.ts` — No agent CLI invocation
- `app/lib/workflows/dispatch-deploy-preview.ts` — No agent CLI invocation
