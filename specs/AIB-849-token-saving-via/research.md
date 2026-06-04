# Research: Token saving via RTK + unified per-ticket Run settings

**Feature**: AIB-849 | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)

## Decisions

### Decision: RTK ("Rust Token Killer") is the compression tool
- **Decision**: Use [`rtk-ai/rtk`](https://github.com/rtk-ai/rtk) — a single, dependency-free Rust binary that acts as a CLI proxy. It registers a Claude Code **PreToolUse hook** that transparently rewrites Bash commands (`git status` → `rtk git status`, `npm test` → `rtk npm test`), compresses the command output before it enters the agent's context, and passes output through unchanged when it cannot parse a command.
- **Rationale**: Matches the ticket title ("Token saving via RTK") and every constraint in the spec: obtained over the network at run time, pinnable to a release version, hook-based activation, graceful pass-through on unparseable output, and the published ~60–90% savings on command-heavy stages (`cargo test` ~92%, `git status` ~81%) aligns with SC-002's ~80% reference goal. It is Claude-only by nature (hooks fire only on the Claude Code Bash tool), matching the FR-007 scope limit for free.
- **Alternatives considered**:
  - *npm-based output filter*: no canonical maintained package; would require building our own compression logic (rejected — reinvents RTK).
  - *Context-window summarization inside the agent*: changes agent behavior and risks information loss; spec explicitly forbids new estimation machinery and requires loss-free pass-through (rejected).
  - *Vendoring the binary in the repo*: bloats the repo and defeats "obtained over the network"; pinning a release URL gives reproducibility without vendoring (rejected).

### Decision: Pin RTK to a known-good release, install non-blocking before `invoke_claude`
- **Decision**: Install RTK in `.github/scripts/run-agent.sh`, in the `CLAUDE` branch of `dispatch_agent()`, **after** `ensure_claude_commands` and **before** `invoke_claude`, only when `TOKEN_SAVING=true`. The install command pins an explicit RTK version (constant in the script). The entire install + `rtk init` activation is wrapped so any non-zero exit is swallowed: the run continues with RTK inactive.
- **Rationale**: Mirrors the existing conditional-install pattern (`install_claude`, `install_codex`, `install_mistral`) but inverts the failure policy — those `exit 1` on failure, whereas FR-006/SC-003 mandate that a token-saving failure NEVER aborts the run. So the new function must use a local `set +e` / explicit return-capture and degrade to fallback, never `exit`.
- **Alternatives considered**: Installing inside the workflow YAML step (rejected — splits the activation logic across YAML and bash, and `run-agent.sh` is where every agent decision already lives).

### Decision: Effective value via nullish-coalescing, mirroring agent/policy
- **Decision**: `resolveEffectiveTokenSaving(ticket) = ticket.tokenSaving ?? ticket.project.tokenSaving`. Ticket field is `Boolean?` (null = inherit, `true` = Force ON, `false` = Force OFF); project field is `Boolean @default(false)`.
- **Rationale**: `??` only falls through on `null`/`undefined`, so a `false` ticket override (Force OFF) is correctly respected over a `true` project default — exactly the three-state semantics in FR-002. Directly parallels `resolveEffectiveAgent` (`transition.ts:58-61`) and the inline `ticket.clarificationPolicy ?? ticket.project.clarificationPolicy` (`transition.ts:322`).
- **Alternatives considered**: A dedicated three-value enum (`INHERIT`/`ON`/`OFF`) on the ticket (rejected — nullable boolean is the established override shape and needs no new enum; less storage, less UI translation).

### Decision: Token-saving override editable at any stage, guarded by "no active run"
- **Decision**: Unlike agent/policy (INBOX-only via `canEditDescriptionAndPolicy`), the token-saving override is editable at any stage. It is saved through a **dedicated endpoint** that does NOT apply the INBOX gate; instead it rejects edits while a RUNNING/PENDING job exists on the ticket.
- **Rationale**: Auto-Resolved Decision in the spec (low-confidence → CONSERVATIVE) keeps the toggle useful for A/B testing later stages without cloning into INBOX, while never mutating an in-flight run. Following the precedent of `model-config/route.ts` (which already has NO stage gate) keeps the new control fully isolated from the INBOX-only fields and satisfies FR-016 (no change to existing override semantics).
- **Alternatives considered**: Adding `tokenSaving` to the existing ticket PATCH (`patchTicketSchema` + `patchTicketInline`) (rejected — that path enforces the INBOX gate for description/policy/agent; entangling token-saving there risks regressing FR-016 and forces awkward gate-bypass branching).

### Decision: Per-job outcome is a new enum `TokenSavingOutcome { ACTIVE, INACTIVE, FELL_BACK }`
- **Decision**: Add `tokenSavingOutcome TokenSavingOutcome?` to `Job`. The runner reports it via the existing `PATCH /api/jobs/:id/status` callback (extend `jobStatusUpdateSchema`), set at activation time alongside the RUNNING update — the same channel used for `pluginVersion`/`agentCliVersion`.
- **Rationale**: Three explicit states make A/B telemetry unambiguous and distinguish silent fallback from OFF (spec criterion 3, FR-008, SC-004). Reusing the status PATCH avoids a new endpoint and matches AIB-779's runtime-version reporting pattern.
- **Alternatives considered**: A boolean `tokenSavingActive` (rejected — cannot distinguish FELL_BACK from INACTIVE, defeating SC-004). A new dedicated endpoint (rejected — status PATCH already carries job-start annotations).

## Existing Files

### Reuse as-is / extend (server + data)
| Path | Covers | Action |
|------|--------|--------|
| `prisma/schema.prisma` | `Project` (L123-124 policy/agent defaults), `Ticket` (L196-197 nullable overrides), `Job` (L29-83 telemetry), enums (L359-395) | **Extend**: `Project.tokenSaving Boolean @default(false)`; `Ticket.tokenSaving Boolean?`; `Job.tokenSavingOutcome TokenSavingOutcome?`; new `TokenSavingOutcome` enum |
| `lib/workflows/transition.ts` | `resolveEffectiveAgent` (L58-61), effective policy (L322), `workflowInputs` build + dispatch (L268-355) | **Extend**: add `resolveEffectiveTokenSaving`; add `tokenSaving` to `workflowInputs` for standard/quick/verify Claude stages |
| `lib/db/projects.ts` | `updateProject` (L202-260), conditional field application (L247-248) | **Extend**: apply `tokenSaving` when `!== undefined` |
| `lib/db/tickets.ts` | `duplicateTicket` (L619-676, copies `clarificationPolicy`/`agent` at L668-669), `fullCloneTicket` (L681+, copies at L735-736), `patchTicketInline` (L403-485, INBOX gate L437-450) | **Extend**: copy `tokenSaving` in both clone paths (Edge Case "Clone behavior"); add token-saving DB helper used by the new endpoint |
| `app/lib/schemas/clarification-policy.ts` | `projectUpdateSchema` (L7-21) | **Extend**: add `tokenSaving: z.boolean().optional()` |
| `app/api/projects/[projectId]/route.ts` | Project PATCH (L61-79), owner-only auth | **Extend**: passes new field through `updateProject` (owner-only already enforced) |
| `app/lib/job-update-validator.ts` | `jobStatusUpdateSchema` (L20-29) | **Extend**: add `tokenSavingOutcome: z.enum(['ACTIVE','INACTIVE','FELL_BACK']).optional()` |
| `app/api/jobs/[id]/status/route.ts` | Status PATCH (L64-381), workflow auth, persists runtime versions | **Extend**: persist `tokenSavingOutcome` on Job |
| `lib/types/job-types.ts` | `TicketJobWithTelemetry` (L55-78) | **Extend**: add `tokenSavingOutcome` |

### Reuse as-is / extend (runner + workflows)
| Path | Covers | Action |
|------|--------|--------|
| `.github/scripts/run-agent.sh` | `install_claude` (L458-474), `dispatch_agent` CLAUDE branch (L876-883), `report_runtime_versions`/status PATCH (~L399-414) | **Extend**: add `install_rtk`/`activate_rtk` (non-blocking); wire into CLAUDE branch; PATCH `tokenSavingOutcome` |
| `.github/workflows/speckit.yml`, `quick-impl.yml`, `verify.yml`, `iterate.yml` | dispatch inputs → env (e.g. `agent`, `model`) → run-agent.sh | **Extend**: add boolean `tokenSaving` input → env `TOKEN_SAVING` |

### Create new (UI)
| Path | Responsibility |
|------|----------------|
| `components/projects/token-saving-card.tsx` | Owner-only project settings card (US1). Verify no existing project-settings card covers it before creating. |
| `components/tickets/run-settings-dialog.tsx` | Consolidated dialog with 4 sections (US3) — composes existing Agent/Models/Policy controls + new Token saving section |
| `components/ui/token-saving-badge.tsx` | Header status-strip badge shown when effective ON (US4) — mirrors `policy-badge.tsx` |
| `app/lib/utils/token-saving-icons.ts` | Static label/description helpers (mirrors `app/lib/utils/policy-icons.ts`) |
| `app/api/projects/[projectId]/tickets/[id]/token-saving/route.ts` | Dedicated PATCH for the ticket override (no INBOX gate; active-run guard) — mirrors `model-config/route.ts` |

### Modify (UI)
| Path | Change |
|------|--------|
| `components/board/ticket-detail-modal.tsx` | Replace kebab items "Edit Policy/Agent/Models" (L990-1016) with single "Run settings"; render `TokenSavingBadge` in status strip (after L941); compute `effectiveTokenSaving`/`isTokenSavingOverride` (near L851-852) |
| `components/tickets/policy-edit-dialog.tsx`, `agent-edit-dialog.tsx`, `model-override-dialog.tsx` | Reused as section content inside Run settings (kept as standalone components, composed by the new dialog) |
| `components/ticket/jobs-timeline.tsx` | Render token-saving outcome indicator in `JobRow` (near telemetry block L209-265) using a static icon/label map like `STATUS_ICONS` (L68-74) |
| Project settings page (host of project cards) | Mount `TokenSavingCard` |

### Existing tests to EXTEND (constitution III: search first, don't duplicate)
| Path | Covers | Extend with |
|------|--------|-------------|
| `tests/integration/tickets/transitions.test.ts` | policy/agent override create + PATCH + invalid (L453-490), `Job.model` null for non-Claude (L569) | effective token-saving resolution; dispatch carries `tokenSaving`; non-Claude unaffected |
| `tests/integration/tickets/model-override.test.ts` | model-config PATCH, reset, validation (L21+) | pattern reference for the new token-saving endpoint integration test |
| `tests/unit/job-update-validator.test.ts` | `jobStatusUpdateSchema` | accepts/validates `tokenSavingOutcome` |
| `tests/unit/components/ticket-detail-modal.test.tsx` | status strip, kebab, badges (L145-372) | kebab shows exactly 3 items; token-saving badge visibility ON/OFF |
| `tests/unit/components/agent-edit-dialog.test.tsx`, `model-override-dialog.test.tsx` | inherit/override indicator patterns | reference for `run-settings-dialog` + token-saving section tests |
| `tests/unit/components/ticket-stats.test.tsx` | telemetry rendering | reference for outcome-indicator rendering in jobs-timeline |

### New test files (only where no existing file covers the domain)
- `tests/integration/tickets/token-saving.test.ts` — project default PATCH (owner-only), ticket override endpoint (active-run guard, no INBOX gate), clone carries override.
- `tests/unit/components/run-settings-dialog.test.tsx` — four sections render, inherited defaults + override indicators, INBOX-only gating preserved for Agent/Policy, token-saving editable past INBOX.
- `tests/unit/components/token-saving-badge.test.tsx` — badge shown when effective ON, hidden when OFF.

## Patterns to Follow

### Effective-value resolution — `lib/workflows/transition.ts:58-61, 322`
```ts
export function resolveEffectiveAgent(ticket: TicketWithProject): Agent {
  return ticket.agent ?? ticket.project.defaultAgent ?? Agent.CLAUDE;
}
// ...
const effectivePolicy = ticket.clarificationPolicy ?? ticket.project.clarificationPolicy;
```
New `resolveEffectiveTokenSaving` MUST use the identical `??` shape so a `false` override is honored.

### Dispatch payload threading — `lib/workflows/transition.ts:268-355`
Effective values are computed before dispatch and placed in `workflowInputs`, then sent via `octokit.actions.createWorkflowDispatch({ inputs: workflowInputs })` (L349-355). Add `tokenSaving: String(effectiveTokenSaving)` to the standard/quick/verify Claude payloads here — never compute the effective value inside the runner.

### Conditional install, but NON-blocking — `.github/scripts/run-agent.sh:458-474`
`install_claude` returns early if present, else installs, else `exit 1`. The RTK installer MUST follow the early-return/install shape **but invert the failure branch**: on any failure set the outcome to `FELL_BACK` and `return 0` (never `exit`), per FR-006/SC-003. Capture exit codes with explicit `set +e`/`local rc=$?` like the Gemini branch (L907-909) does.

### DB-mutation-then-external-call ordering — constitution V & `transition.ts:336`
The override is persisted (DB) before any dispatch; dispatch failures must not leave the ticket in an inconsistent state. The token-saving endpoint persists then returns; activation happens only at run time in the runner, so there is no orphaned-state risk.

### Status-callback annotation — `app/lib/job-update-validator.ts:25-28` + `run-agent.sh ~L399-414`
`pluginVersion`/`agentCliVersion` are optional fields added to the RUNNING status PATCH and persisted first-write-wins. `tokenSavingOutcome` follows the same channel and persistence rule.

### Badge composition — `components/ui/policy-badge.tsx:23-54` + `ticket-detail-modal.tsx:920-941`
Badges are static-class `<Badge>` compositions with a `title` tooltip and an `isOverride` indicator. `TokenSavingBadge` mirrors `PolicyBadge`; the strip renders it conditionally (`effectiveTokenSaving === true`) exactly like the agent badge guard (`{effectiveAgent && ...}`). All Tailwind classes MUST be full literal strings (CLAUDE.md / `badge.tsx:94-96`).

### Clone field-copy — `lib/db/tickets.ts:668-669, 735-736`
Both `duplicateTicket` and `fullCloneTicket` copy `clarificationPolicy` and `agent` verbatim. Add `tokenSaving: sourceTicket.tokenSaving` in both to satisfy the "Clone behavior" edge case.
