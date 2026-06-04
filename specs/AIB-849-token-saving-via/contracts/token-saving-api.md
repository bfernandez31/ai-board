# API Contracts: Token saving via RTK + unified Run settings

All routes follow existing patterns: try/catch with structured `{ error, code? }` errors, 401/403 for auth, Zod validation, optimistic-concurrency `version` where the underlying resource already uses it.

---

## 1. Update project token-saving default (extends existing route)

`PATCH /api/projects/:projectId`

**Auth**: project **owner** only (`verifyProjectOwnership`). Members → 403.

**Request body** (extends `projectUpdateSchema`):
```jsonc
{ "tokenSaving": true }   // boolean, optional — combined with existing fields
```

**Responses**:
- `200` — `{ ...project, "tokenSaving": true }`
- `400` — `{ "error": "Validation failed", "code": "VALIDATION_ERROR" }`
- `403` — `{ "error": "...", "code": "FORBIDDEN" }` (non-owner)
- `404` — project not found

**Behavior**: applied in `updateProject` only when `tokenSaving !== undefined` (matches L247-248 conditional pattern). FR-001.

---

## 2. Update ticket token-saving override (NEW dedicated route)

`PATCH /api/projects/:projectId/tickets/:id/token-saving`

Modeled on `model-config/route.ts` — deliberately **no INBOX stage gate**.

**Auth**: `verifyTicketAccess` (owner or member).

**Request body** (`tokenSavingOverrideSchema`):
```jsonc
{
  "tokenSaving": true | false | null,   // true=Force ON, false=Force OFF, null=Inherit
  "version": 7                          // optimistic concurrency (matches ticket PATCH)
}
```

**Responses**:
- `200` — `{ "tokenSaving": true|false|null, "version": 8 }`
- `400` — `{ "error": "...", "code": "VALIDATION_ERROR" }`
- `409 ACTIVE_RUN` — `{ "error": "Cannot change token saving while a run is in progress", "code": "ACTIVE_RUN" }` when a RUNNING/PENDING job exists on the ticket (FR-013, Edge Case "mid-run")
- `409 VERSION_CONFLICT` — stale `version`
- `403` / `404`

**Behavior**: persists `Ticket.tokenSaving`; setting `null` clears the override → project default (FR-015). Editable at any stage when no active run.

---

## 3. Report per-job token-saving outcome (extends existing status route)

`PATCH /api/jobs/:id/status`

**Auth**: workflow token (`validateWorkflowAuth`).

**Request body** (extends `jobStatusUpdateSchema`):
```jsonc
{
  "status": "RUNNING",
  "tokenSavingOutcome": "ACTIVE"   // "ACTIVE" | "INACTIVE" | "FELL_BACK", optional
}
```

**Responses**:
- `200` — job updated
- `400` — invalid enum / status
- `401` — bad/missing workflow token

**Behavior**: persists `Job.tokenSavingOutcome` first-write-wins, alongside the existing runtime-version annotation channel (FR-008, SC-004).

---

## 4. UI contracts (component-level)

### Kebab menu (`ticket-detail-modal.tsx`)
Exactly three items, in order: **Run settings**, **Simple copy**, **Full clone**. No standalone Edit Policy / Edit Agent / Edit Models (FR-010, SC-005).

### Run settings dialog (`run-settings-dialog.tsx`)
Four sections, each showing inherited project default + override indicator (FR-011):
1. **Agent** — read-only outside INBOX (existing rule).
2. **Models (per stage)** — per-stage editability (existing rule).
3. **Clarification policy** — read-only outside INBOX (existing rule).
4. **Token saving** — three-state (Inherit / Force ON / Force OFF); editable at any stage unless a run is active.

Each section persists via its respective endpoint (policy/agent → ticket PATCH; models → model-config; token saving → §2). Existing validation/permissions unchanged (FR-012, FR-016).

### Header status-strip badge (`token-saving-badge.tsx`)
Rendered iff `effectiveTokenSaving === true`; compact icon + tooltip stating state and source (inherited vs override). Nothing rendered when OFF (FR-014, US4).

### Job details (`jobs-timeline.tsx`)
`JobRow` shows a token-saving outcome indicator (ACTIVE / INACTIVE / FELL_BACK), FELL_BACK visually distinct from INACTIVE (FR-008, spec reviewer note).
