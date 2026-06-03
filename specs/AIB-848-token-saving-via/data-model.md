# Data Model: Token saving via RTK + unified per-ticket Run settings

## Project Run Settings

Backed by `Project` in `prisma/schema.prisma`.

Fields:

- `tokenSavingEnabled: Boolean @default(false)` - Owner-controlled project default. Existing projects and newly created projects default to OFF.
- Existing fields retained: `clarificationPolicy`, `defaultAgent`, Claude per-stage model defaults, Codex per-stage model defaults.

Validation rules:

- Must be a boolean.
- Only the project owner may update `tokenSavingEnabled`.
- Members may continue using permissions already granted for other project settings unless those settings are intentionally tightened in a separate change.

Relationships:

- One project has many tickets. Tickets with `tokenSavingOverride = null` inherit this value for future runs.

## Ticket Run Settings

Backed by `Ticket` in `prisma/schema.prisma`.

New enum:

```prisma
enum TokenSavingOverride {
  FORCE_ON
  FORCE_OFF
}
```

Fields:

- `tokenSavingOverride: TokenSavingOverride?` - Nullable ticket override. `null` means inherit project default; `FORCE_ON` forces enabled; `FORCE_OFF` forces disabled.
- Existing run settings retained: `agent`, `clarificationPolicy`, Claude per-stage model overrides, Codex per-stage model overrides.

Validation rules:

- `null`, `FORCE_ON`, and `FORCE_OFF` are the only accepted states at the API boundary.
- Authorized project users may view the setting.
- Authorized project users may edit this ticket override only when the ticket is in the same stages where agent and clarification-policy overrides are editable. Today that is `INBOX`, via `canEditDescriptionAndPolicy`.
- Stage restrictions are enforced server-side, not only in the dialog.

State transitions:

- INBOX ticket can move between inherit, force on, and force off.
- After the editable stage window closes, the value remains visible but read-only.
- Simple copy preserves the ticket token-saving override and resets runtime state like other ticket-level run settings.
- Full clone preserves the ticket override and copies historic job token-saving statuses as job telemetry snapshots.

Resolution:

```text
if ticket.tokenSavingOverride == FORCE_ON  -> effectiveEnabled = true
if ticket.tokenSavingOverride == FORCE_OFF -> effectiveEnabled = false
otherwise                                  -> effectiveEnabled = project.tokenSavingEnabled
```

## Workflow Job

Backed by `Job` in `prisma/schema.prisma`.

New enum:

```prisma
enum TokenSavingRunStatus {
  ACTIVE
  INACTIVE
  FALLBACK
  NOT_APPLICABLE
  NOT_RECORDED
}
```

Fields:

- `tokenSavingRequested: Boolean @default(false)` - The effective ticket/project value captured when the job starts.
- `tokenSavingStatus: TokenSavingRunStatus @default(NOT_RECORDED)` - Run-level status for display and comparison.
- `tokenSavingFallbackReason: String? @db.VarChar(1000)` - Optional bounded reason when status is `FALLBACK`.

Validation rules:

- `ACTIVE` means token saving was requested for a Claude core command and RTK activation succeeded before agent invocation.
- `INACTIVE` means effective token saving was OFF for the run.
- `FALLBACK` means token saving was requested but setup/activation failed and the run continued normally.
- `NOT_APPLICABLE` means settings may exist but the job is outside Phase 1 scope, such as non-Claude agents or auxiliary workflows.
- `NOT_RECORDED` means the job predates capture or no status was recorded.
- `tokenSavingFallbackReason` is only meaningful for `FALLBACK`; UI should ignore it for other statuses.

State transitions:

- Job creation sets `tokenSavingRequested` from the fresh ticket/project snapshot.
- Job creation sets `tokenSavingStatus` to `INACTIVE` when requested is false.
- Job creation sets `tokenSavingStatus` to `NOT_APPLICABLE` when requested is true but the effective agent/command is outside scope.
- Claude core workflows PATCH `ACTIVE` or `FALLBACK` before or during RUNNING status.
- Terminal status callbacks preserve the previously recorded token-saving status; if a requested Claude core job reaches terminal state without an activation report, it remains `NOT_RECORDED` and must be treated as a workflow-reporting defect by tests.

## Job Telemetry

Existing telemetry remains authoritative for savings comparisons:

- `inputTokens`
- `outputTokens`
- `thinkingTokens`
- `cacheReadTokens`
- `cacheCreationTokens`
- `peakContextTokens`
- `avgContextTokens`
- `durationMs`
- `costUsd`
- `model`
- `toolsUsed`

No new estimated-savings fields are added in this phase.

## Derived UI State

Run settings display should derive:

- `projectDefault`: `ON` or `OFF`
- `ticketOverride`: `INHERIT`, `FORCE_ON`, or `FORCE_OFF`
- `effectiveEnabled`: boolean
- `source`: `project` or `ticket`
- `editable`: boolean from stage and permission checks
- `statusIndicatorVisible`: true only when `effectiveEnabled` is true for the current ticket
