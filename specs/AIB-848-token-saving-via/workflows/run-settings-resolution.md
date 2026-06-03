# Workflow Artifact: Run settings resolution

## Trigger Points

- Ticket detail display
- Run settings dialog open/save
- Ticket simple copy and full clone
- Stage transition workflow dispatch
- Job telemetry display and comparison views

## Inputs

- `Project.tokenSavingEnabled`
- `Ticket.tokenSavingOverride`
- `Ticket.agent`
- `Project.defaultAgent`
- Existing per-stage model defaults and overrides
- Existing clarification-policy defaults and overrides
- Current ticket stage
- Current user project permission
- Workflow command

## Resolution Steps

1. Resolve effective agent with existing precedence: ticket override, project default, Claude fallback.
2. Resolve token-saving effective setting:
   - `FORCE_ON` -> enabled
   - `FORCE_OFF` -> disabled
   - `null` -> project `tokenSavingEnabled`
3. Resolve editability:
   - token-saving override uses the same stage rule as ticket agent and clarification-policy overrides
   - project default uses owner-only authorization
   - model editability remains whatever the existing model override endpoint enforces
4. When a job starts, freeze the effective token-saving setting onto the job.
5. Pass only the frozen job setting to workflow inputs.
6. Display current ticket effective token-saving state from ticket/project fields, not from historic jobs.
7. Display historic run token-saving state from `Job` fields, not current ticket/project settings.

## Error Behavior

- Invalid override values are rejected with validation errors before persistence.
- Unauthorized project default updates are rejected server-side.
- Ticket override updates outside the editable stage window are rejected server-side.
- If a ticket changes concurrently, existing version conflict handling applies.

## Output

- Effective run settings for the ticket header and Run settings dialog.
- Persisted ticket override when saved.
- Immutable job token-saving fields when workflow automation starts.
- Job telemetry rows with token-saving run status.
