# Data Model: Project Config in DB

**Branch**: `AIB-478-project-config-in` | **Date**: 2026-04-02

## Schema Changes

### Project Model (extend existing)

Add two nullable fields to the `Project` model in `prisma/schema.prisma`:

```prisma
model Project {
  // ... existing fields ...

  config          Json?       // Parsed ProjectConfig (excludes env section)
  configSyncedAt  DateTime?   // Last successful config sync timestamp

  // ... existing relations ...
}
```

**Field Details**:

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `config` | `Json` | Yes | `null` | Parsed and validated `.ai-board/config.yml` content (minus `env` section). Stored as PostgreSQL `jsonb`. |
| `configSyncedAt` | `DateTime` | Yes | `null` | Timestamp of last successful sync from GitHub. Used for staleness checks (>1h = stale). |

**Why nullable**: Existing projects have no config. Null means "never synced" — the system falls back to hardcoded defaults (PostgreSQL 16, Bun). No migration action required for existing data.

### No New Models Required

Config is stored directly on the `Project` record. No separate table needed because:
- Config is always read/written as a unit (not queried by individual fields)
- One config per project (1:1 relationship)
- Structured JSON provides flexibility for schema evolution

## Entity: ProjectConfig (Application Type)

Already defined in `lib/validations/config.ts` as a Zod-inferred type. The stored JSON conforms to this shape **minus the `env` section**:

```typescript
// Stored in project.config (Json field)
interface StoredConfig {
  version: 1;
  project: {
    name: string;
    language: 'typescript' | 'python' | 'go' | 'rust' | 'java';
    framework: 'nextjs' | 'express' | 'fastapi' | 'django' | 'gin' | 'none';
  };
  runtime: {
    manager: 'bun' | 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry' | 'cargo';
    manager_version?: string;
    node?: string;
    python?: string;
  };
  services: Array<{
    type: 'postgres' | 'redis' | 'mysql' | 'mongo';
    version: string;
    database?: string;
    username?: string;
    password?: string;
  }>;
  commands: {
    install: string;
    build?: string;
    lint?: string;
    type_check?: string;
    test_unit?: string;
    test_integration?: string;
    test_e2e?: string;
  };
  agent: {
    cli: 'claude-code' | 'codex';
    model?: string;
  };
}
```

## Validation Rules

1. **On sync**: Full Zod validation via `validateConfig()` from `lib/validations/config.ts`
2. **On store**: Strip the `env` section before persisting to DB
3. **On read**: Cast `project.config` to `ProjectConfig` type (JSON fields are untyped in Prisma)
4. **Staleness**: `configSyncedAt` is null or `> 1 hour ago` → stale

## Service Input Mapping

The `getProjectServiceInputs()` function maps stored config to workflow dispatch inputs:

| Config Path | Workflow Input | Example |
|-------------|---------------|---------|
| `services[type=postgres]` | `needs_postgres: 'true'`, `postgres_version: '{version}'` | `needs_postgres: 'true'`, `postgres_version: '14'` |
| `services[type=redis]` | `needs_redis: 'true'`, `redis_version: '{version}'` | `needs_redis: 'true'`, `redis_version: '7'` |
| `services[type=mysql]` | `needs_mysql: 'true'`, `mysql_version: '{version}'` | `needs_mysql: 'true'`, `mysql_version: '8'` |
| `services[type=mongo]` | `needs_mongo: 'true'`, `mongo_version: '{version}'` | `needs_mongo: 'true'`, `mongo_version: '7'` |
| `runtime.manager` | `package_manager: '{manager}'` | `package_manager: 'npm'` |
| No config (null) | Defaults | `needs_postgres: 'true'`, `postgres_version: '16'`, `package_manager: 'bun'` |

## Migration

```sql
-- Migration: add_project_config_fields
ALTER TABLE "Project" ADD COLUMN "config" JSONB;
ALTER TABLE "Project" ADD COLUMN "configSyncedAt" TIMESTAMP(3);
```

**Impact**: Zero — both fields are nullable with no default. Existing rows get `null` for both fields. No data migration needed.
