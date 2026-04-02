# API Contract: Config Sync

**Branch**: `AIB-478-project-config-in` | **Date**: 2026-04-02

## POST /api/projects/:projectId/config/sync

Fetches `.ai-board/config.yml` from the project's GitHub repository, validates it, and stores the parsed config in the database.

### Authorization

- Requires authenticated session (NextAuth)
- Requires project access: owner OR member (`verifyProjectAccess`)

### Request

**URL Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | `string` (numeric) | Yes | Project ID |

**Body**: None

### Responses

#### 200 OK — Config synced successfully

```json
{
  "config": {
    "version": 1,
    "project": { "name": "my-app", "language": "typescript", "framework": "nextjs" },
    "runtime": { "manager": "bun" },
    "services": [{ "type": "postgres", "version": "14" }],
    "commands": { "install": "bun install" },
    "agent": { "cli": "claude-code" }
  },
  "syncedAt": "2026-04-02T12:00:00.000Z",
  "warnings": []
}
```

#### 200 OK — Config synced with warnings

```json
{
  "config": { "..." },
  "syncedAt": "2026-04-02T12:00:00.000Z",
  "warnings": [
    { "path": "custom_field", "message": "Unknown field 'custom_field' — this field is not part of the config schema and will be ignored." }
  ]
}
```

#### 400 Bad Request — Invalid config YAML

```json
{
  "error": "Config validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "path": "project.language",
      "type": "invalid_value",
      "value": "ruby",
      "message": "Invalid value 'ruby' for 'project.language'. Allowed values: typescript, python, go, rust, java."
    }
  ]
}
```

#### 404 Not Found — No config file in repository

```json
{
  "error": "No .ai-board/config.yml found in repository",
  "code": "CONFIG_NOT_FOUND"
}
```

#### 401 Unauthorized — Not authenticated

```json
{
  "error": "Unauthorized"
}
```

#### 404 Not Found — Project not found or no access

```json
{
  "error": "Project not found"
}
```

#### 502 Bad Gateway — GitHub API error

```json
{
  "error": "Failed to fetch config from GitHub",
  "code": "GITHUB_ERROR"
}
```

---

## GET /api/projects/:projectId

Extended response includes config fields.

### Existing Response + New Fields

```json
{
  "id": 1,
  "name": "my-project",
  "description": "...",
  "githubOwner": "owner",
  "githubRepo": "repo",
  "key": "AIB",
  "clarificationPolicy": "AUTO",
  "defaultAgent": "CLAUDE",
  "config": { "..." },
  "configSyncedAt": "2026-04-02T12:00:00.000Z"
}
```

When no config has been synced, both fields are `null`:

```json
{
  "config": null,
  "configSyncedAt": null
}
```

---

## Internal: getProjectServiceInputs() Output

Not an API endpoint but a critical internal contract consumed by all workflow dispatchers.

### Input

`Project` record from Prisma (with `config: Json?` and `configSyncedAt: DateTime?`)

### Output

`Record<string, string>` — flat key-value pairs for GitHub Actions workflow inputs.

### Mapping Examples

**With config (PostgreSQL 14 + Redis 7)**:
```json
{
  "needs_postgres": "true",
  "postgres_version": "14",
  "needs_redis": "true",
  "redis_version": "7"
}
```

**Without config (null — defaults)**:
```json
{
  "needs_postgres": "true",
  "postgres_version": "16"
}
```

**With config but no services**:
```json
{}
```

> **Note**: `package_manager` is NOT a dispatch input. `setup-environment.sh` reads `runtime.manager` directly from the cloned repo's `.ai-board/config.yml` at workflow runtime. Dispatch only passes service container flags (`needs_*`, `*_version`).
