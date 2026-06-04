# API Contracts: Token Saving + Unified Run Settings

## Modified Endpoints

### PATCH `/api/projects/[projectId]`

**New accepted field**:
```json
{
  "tokenSaving": true
}
```

**Validation**: `z.boolean().optional()`  
**Authorization**: Project owner only (existing check)

### GET `/api/projects/[projectId]/tickets/[id]`

**New response field**:
```json
{
  "tokenSaving": null,
  "project": {
    "tokenSaving": false
  }
}
```

### PATCH `/api/projects/[projectId]/tickets/[id]`

**New accepted field**:
```json
{
  "tokenSaving": true,
  "version": 5
}
```

- `tokenSaving: true` → force ON override
- `tokenSaving: false` → force OFF override  
- `tokenSaving: null` → remove override (inherit from project)

**Validation**: `z.boolean().nullable().optional()`  
**Authorization**: Project member (existing check)  
**Stage restriction**: None — editable at any stage

### POST `/api/projects/[projectId]/tickets/[id]/duplicate`

**Response change** (both simple and full modes):
```json
{
  "tokenSaving": null
}
```

Token saving override is preserved from source ticket.

### PATCH `/api/jobs/[id]/status`

**New accepted field**:
```json
{
  "tokenSavingStatus": "active"
}
```

**Valid values**: `"active"`, `"inactive"`, `"fallback"`, `"n/a"`  
**Validation**: `z.enum(["active", "inactive", "fallback", "n/a"]).optional()`

### GET `/api/projects/[projectId]/jobs/status`

**New response field per job**:
```json
{
  "tokenSavingStatus": "active"
}
```

## Workflow Dispatch Inputs

### All workflow files (speckit.yml, quick-impl.yml, verify.yml, iterate.yml)

**New input**:
```yaml
token_saving:
  description: 'Enable RTK token saving compression'
  required: false
  default: 'false'
  type: string
```

Passed to `run-agent.sh` as environment variable `TOKEN_SAVING`.

## UI Contracts

### Kebab Menu Items (ticket detail)

**Before** (5 items):
1. Edit Policy
2. Edit Agent
3. Edit Models
4. Simple copy
5. Full clone (conditional)

**After** (3 items):
1. Run settings
2. Simple copy
3. Full clone (conditional)

### Run Settings Dialog Sections

| Section | Editable When | Override Value Type |
|---------|--------------|-------------------|
| Agent | INBOX only | `Agent \| null` |
| Models (per stage) | All stages | `string \| null` per stage |
| Clarification Policy | INBOX only | `ClarificationPolicy \| null` |
| Token Saving | All stages | `boolean \| null` |

Each section shows:
- Current effective value with "(override)" or "(project default)" label
- Selection control appropriate to the value type
- "Use project default" option to clear override
