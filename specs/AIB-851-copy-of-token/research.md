# Research: Token Saving via RTK + Unified Per-Ticket Run Settings

**Branch**: `AIB-851-copy-of-token` | **Date**: 2026-06-04

## Technical Decisions

### Decision 1: Token Saving Field Placement

- **Decision**: Add `tokenSaving` Boolean field (default `false`) to Project, and `tokenSaving` nullable Boolean to Ticket
- **Rationale**: Follows the exact same nullable override pattern as `clarificationPolicy` and `agent` on Ticket. Resolution chain: ticket override > project default > OFF (global fallback). Boolean is simpler than an enum since there are only two states (ON/OFF), with the nullable layer providing the three-state behavior (force ON, force OFF, inherit).
- **Alternatives considered**: JSON config field on Project (rejected — all other settings are explicit columns), enum with ON/OFF/AUTO values (rejected — nullable Boolean achieves the same with less schema noise)

### Decision 2: Token Saving Status on Job

- **Decision**: Add `tokenSavingStatus` String field (nullable, VarChar 20) to Job model, accepting values: `"active"`, `"inactive"`, `"fallback"`, `"n/a"`
- **Rationale**: A string field is simpler than an enum for a status that's written once by the runner and read for display. Values: `active` = RTK installed and working, `inactive` = setting was OFF or agent is not Claude, `fallback` = setting was ON but RTK failed to install/activate, `n/a` = non-Claude agent.
- **Alternatives considered**: Prisma enum (rejected — requires migration for new values, overkill for a display-only field), Boolean pair `tokenSavingRequested`/`tokenSavingActive` (rejected — doesn't capture fallback state)

### Decision 3: Unified Run Settings Dialog Architecture

- **Decision**: Create a new `RunSettingsDialog` component that composes sections for Agent, Models, Clarification Policy, and Token Saving. Replace three separate dialog open states with a single `runSettingsOpen` state. Use tabs or accordion sections within the dialog.
- **Rationale**: The current architecture uses three separate dialogs (`PolicyEditDialog`, `AgentEditDialog`, `ModelOverrideDialog`) each with independent state and save handlers. The unified dialog reduces the kebab menu from 5 items to 3 and allows users to configure all overrides in one place.
- **Alternatives considered**: Keeping separate dialogs behind a single menu item (rejected — doesn't achieve the single-dialog UX from the spec), full-page settings (rejected — inconsistent with modal-based ticket detail view)

### Decision 4: RTK Integration in run-agent.sh

- **Decision**: Add a `token_saving` input to all Claude-relevant workflow files (speckit.yml, quick-impl.yml, verify.yml, iterate.yml). In run-agent.sh, when `TOKEN_SAVING=true` and agent is CLAUDE, download RTK binary and configure as Claude Code PreToolUse hook before invocation.
- **Rationale**: run-agent.sh is the single entry point for all agent invocations (line 1 of all workflows). Adding RTK activation before the Claude invocation block (currently lines 458-501) ensures consistent behavior across all commands. Graceful fallback on any RTK setup failure is achieved by wrapping in a conditional block that sets a status variable.
- **Alternatives considered**: Installing RTK in the workflow YAML (rejected — duplicated across 4 files), making RTK a permanent fixture (rejected — spec requires it to be opt-in per ticket)

### Decision 5: Token Saving Resolution at Dispatch Time

- **Decision**: Resolve the effective token saving setting in `transition.ts` at dispatch time, and pass it as a workflow input. The runner does not query the database.
- **Rationale**: Follows the exact pattern of agent and model resolution. The runner receives all configuration as workflow inputs and does not have database access. Resolution: `ticket.tokenSaving ?? project.tokenSaving ?? false`.
- **Alternatives considered**: Having the runner query an API (rejected — runner has no auth to the app API, adds latency and failure mode)

## Existing Files

### Database & Schema
| Path | What it covers | Action |
|------|---------------|--------|
| `prisma/schema.prisma` | All models — Project (line 112), Ticket (line 180), Job (line 29) | **Extend**: Add `tokenSaving` to Project, Ticket; `tokenSavingStatus` to Job |

### API Routes
| Path | What it covers | Action |
|------|---------------|--------|
| `app/api/projects/[projectId]/route.ts` | Project GET/PATCH/DELETE | **Extend**: Accept `tokenSaving` in PATCH |
| `app/api/projects/[projectId]/tickets/[id]/route.ts` | Ticket GET/PATCH/DELETE | **Extend**: Accept `tokenSaving` in PATCH, return in GET |
| `app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts` | Simple copy + full clone | **Extend**: Serialize `tokenSaving` field |
| `app/api/projects/[projectId]/tickets/[id]/model-config/route.ts` | Ticket model overrides | No change needed |
| `app/api/jobs/[id]/status/route.ts` | Job status PATCH from runner | **Extend**: Accept `tokenSavingStatus` |

### Validation Schemas
| Path | What it covers | Action |
|------|---------------|--------|
| `app/lib/schemas/clarification-policy.ts` | `projectUpdateSchema`, `ticketUpdateSchema` | **Extend**: Add `tokenSaving` to both |
| `lib/validations/ticket.ts` | `patchTicketSchema`, `ticketResponseSchema` | **Extend**: Add `tokenSaving` to both |

### Workflow Dispatch
| Path | What it covers | Action |
|------|---------------|--------|
| `lib/workflows/transition.ts` | Stage transitions + workflow dispatch | **Extend**: Resolve effective token saving, pass as workflow input |
| `.github/workflows/speckit.yml` | SPECIFY/PLAN/BUILD | **Extend**: Add `token_saving` input, pass to run-agent.sh |
| `.github/workflows/quick-impl.yml` | Quick implementation | **Extend**: Add `token_saving` input |
| `.github/workflows/verify.yml` | Verification + PR | **Extend**: Add `token_saving` input |
| `.github/workflows/iterate.yml` | Iteration fixes | **Extend**: Add `token_saving` input |
| `.github/scripts/run-agent.sh` | Agent invocation (946 lines) | **Extend**: Add RTK install/activate block before Claude invocation |

### UI Components
| Path | What it covers | Action |
|------|---------------|--------|
| `components/settings/clarification-policy-card.tsx` | Project policy card | **Pattern reference**: Follow same card pattern for new TokenSavingCard |
| `components/settings/default-agent-card.tsx` | Project agent card | **Pattern reference** |
| `app/projects/[projectId]/settings/page.tsx` | Settings page layout | **Extend**: Add TokenSavingCard |
| `components/board/ticket-detail-modal.tsx` | Ticket detail with kebab menu (1500 lines) | **Modify**: Replace 3 menu items + 3 dialogs with single "Run settings" + RunSettingsDialog |
| `components/tickets/policy-edit-dialog.tsx` | Policy override dialog | **Reuse as-is**: Compose into RunSettingsDialog section |
| `components/tickets/agent-edit-dialog.tsx` | Agent override dialog | **Reuse as-is**: Compose into RunSettingsDialog section |
| `components/tickets/model-override-dialog.tsx` | Model override dialog | **Reuse as-is**: Compose into RunSettingsDialog section |
| `components/ui/policy-badge.tsx` | Policy badge in header | **Pattern reference**: Follow same pattern for token saving badge |
| `components/ui/badge.tsx` | Core badge component (12 variants) | No change needed |

### DB Functions
| Path | What it covers | Action |
|------|---------------|--------|
| `lib/db/tickets.ts:619` | `duplicateTicket()` | **Extend**: Copy `tokenSaving` field |
| `lib/db/tickets.ts:681` | `fullCloneTicket()` | **Extend**: Copy `tokenSaving` field |

### Tests
| Path | What it covers | Action |
|------|---------------|--------|
| `tests/integration/projects/settings.test.ts` | Project settings API | **Extend**: Add token saving toggle tests |
| `tests/integration/tickets/duplicate.test.ts` | Clone/copy API | **Extend**: Verify token saving preservation |
| `tests/integration/tickets/model-override.test.ts` | Model override API | **Pattern reference** |
| `tests/unit/components/ticket-detail-modal.test.tsx` | Ticket detail modal | **Extend**: Test kebab menu items, RunSettingsDialog |
| `tests/unit/components/agent-edit-dialog.test.tsx` | Agent dialog | **Pattern reference** |
| `tests/unit/components/model-override-dialog.test.tsx` | Model dialog | **Pattern reference** |
| `tests/unit/workflows/model-resolution.test.ts` | Model resolution | **Pattern reference** for token saving resolution tests |

## Patterns to Follow

### Override Resolution Pattern (transition.ts:59)
```typescript
export function resolveEffectiveAgent(ticket: TicketWithProject): Agent {
  return ticket.agent ?? ticket.project.defaultAgent ?? Agent.CLAUDE;
}
```
Token saving MUST follow this exact pattern:
```typescript
export function resolveEffectiveTokenSaving(ticket: TicketWithProject): boolean {
  return ticket.tokenSaving ?? ticket.project.tokenSaving ?? false;
}
```

### Dispatch Input Pattern (transition.ts:270-286)
Workflow inputs are assembled as `Record<string, string>` with conditional spreading:
```typescript
workflowInputs = {
  ...existingInputs,
  ...(resolvedModel && { model: resolvedModel }),
};
```
Token saving MUST be passed the same way:
```typescript
...(effectiveTokenSaving && { token_saving: 'true' }),
```

### Error Recovery on Dispatch Failure (transition.ts:365)
When GitHub dispatch fails, the pending job is deleted:
```typescript
await prisma.job.delete({ where: { id: job.id } }).catch(deleteError => { ... });
```
Token saving adds NO additional cleanup — it's resolved before dispatch and has no side effects.

### Settings Card Pattern (clarification-policy-card.tsx)
- Client component with `'use client'`
- Props: `projectId`, `currentValue`, optional `isOwner`
- State: `value`, `isSaving`, toast notifications
- API: `PATCH /api/projects/[projectId]` with the field
- Optimistic update with `router.refresh()` on success

### Override Dialog Pattern (policy-edit-dialog.tsx)
- Props: `open`, `onOpenChange`, `currentValue`, `projectDefaultValue`, `onSave`
- "project-default" as sentinel string value for null/inherit
- Muted box showing current status with "(override)" or "(project default)" label
- Select dropdown with "Use project default" as first option
- `hasChanges` derived from comparing selection to current
- Save handler converts "project-default" to null before calling onSave

### Clone Field Preservation (lib/db/tickets.ts:668-669)
Simple copy preserves override fields explicitly:
```typescript
clarificationPolicy: sourceTicket.clarificationPolicy,
agent: sourceTicket.agent,
```
Token saving MUST be added to both `duplicateTicket` and `fullCloneTicket` data objects.

### Job Status Update Pattern (api/jobs/[id]/status)
Runner reports telemetry fields via PATCH. Token saving status is analogous — a one-time write at job start recording whether RTK is active.

### Badge Pattern (components/ui/policy-badge.tsx)
- Small functional component
- Props: value, isOverride, variant, className
- Renders icon + label + optional "(override)" suffix
- Used in ticket-detail-modal.tsx header strip between separator dots
