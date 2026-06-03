# Contract: Run Settings APIs

## GET `/api/projects/:projectId`

Purpose: Return project settings for settings page and ticket inheritance.

Response additions:

```json
{
  "id": 1,
  "tokenSavingEnabled": false
}
```

Rules:

- `tokenSavingEnabled` is always present.
- Existing response fields remain unchanged.
- Unauthorized users receive existing 401/404 behavior.

## PATCH `/api/projects/:projectId`

Purpose: Update project-level settings.

Request addition:

```json
{
  "tokenSavingEnabled": true
}
```

Rules:

- `tokenSavingEnabled` must be boolean.
- Updating this field requires project owner authorization.
- A project member who is not the owner must receive a forbidden/not-found response consistent with existing owner-only routes.
- Updating unrelated project settings must not change `tokenSavingEnabled`.
- Response includes the updated project with `tokenSavingEnabled`.

## GET `/api/projects/:projectId/tickets/:id`

Purpose: Return ticket details and project defaults needed by the Run settings dialog.

Response additions:

```json
{
  "tokenSavingOverride": null,
  "runSettings": {
    "tokenSaving": {
      "projectDefault": false,
      "override": null,
      "effectiveEnabled": false,
      "source": "project",
      "editable": true
    }
  },
  "project": {
    "tokenSavingEnabled": false
  }
}
```

Rules:

- `tokenSavingOverride` is `null`, `"FORCE_ON"`, or `"FORCE_OFF"`.
- `effectiveEnabled` is derived server-side from the current project default and ticket override.
- `editable` is derived from project access and stage rules.

## PATCH `/api/projects/:projectId/tickets/:id`

Purpose: Update inline ticket settings with optimistic concurrency.

Request addition:

```json
{
  "tokenSavingOverride": "FORCE_ON",
  "version": 1
}
```

Accepted values:

- `null` - inherit project default
- `"FORCE_ON"` - force token saving enabled
- `"FORCE_OFF"` - force token saving disabled

Rules:

- Existing optimistic version checks apply.
- Existing project/ticket access checks apply.
- Server rejects updates outside the same stage window used for agent and clarification-policy overrides.
- Response includes `tokenSavingOverride`, updated `version`, and enough project settings for the dialog to refresh inherited/effective state.

## PATCH `/api/projects/:projectId/tickets/:id/model-config`

Purpose: Existing per-stage model override endpoint used by the Models section of the unified dialog.

Rules:

- Existing validation, cross-agent isolation, reset-all behavior, and permissions remain unchanged.
- The unified dialog may call this endpoint independently or a future combined endpoint may delegate to the same validation.

## GET `/api/projects/:projectId/tickets/:id/jobs`

Purpose: Return job telemetry for Stats and comparison support.

Response additions per job:

```json
{
  "tokenSavingRequested": true,
  "tokenSavingStatus": "ACTIVE",
  "tokenSavingFallbackReason": null
}
```

Rules:

- Historic jobs return `"NOT_RECORDED"` or the persisted default for `tokenSavingStatus`.
- `tokenSavingFallbackReason` is nullable and meaningful only when status is `"FALLBACK"`.

## PATCH `/api/jobs/:id/status`

Purpose: Workflow callback for status and run metadata.

Request additions:

```json
{
  "status": "RUNNING",
  "tokenSavingStatus": "FALLBACK",
  "tokenSavingFallbackReason": "rtk binary was unavailable"
}
```

Accepted token-saving statuses:

- `"ACTIVE"`
- `"INACTIVE"`
- `"FALLBACK"`
- `"NOT_APPLICABLE"`
- `"NOT_RECORDED"`

Rules:

- Workflow bearer token is required.
- `tokenSavingFallbackReason` max length is 1000 characters.
- RUNNING idempotency and first-write-wins behavior mirrors `pluginVersion` and `agentCliVersion`.
- Terminal callbacks do not erase a previously captured token-saving status.
