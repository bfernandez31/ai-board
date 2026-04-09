# Data Model: AIB-585 Retro-Spec Generate

## Schema Changes

### New Enum: `SetupJobCommand`

```prisma
enum SetupJobCommand {
  ONBOARD
  RETRO_SPEC
}
```

### Modified Model: `ProjectSetupJob`

New fields added to the existing model:

```prisma
model ProjectSetupJob {
  // ... existing fields unchanged ...

  // Discriminator: what type of setup job this is
  command         SetupJobCommand @default(ONBOARD)

  // Retro-spec specific inputs (nullable, only for RETRO_SPEC jobs)
  depth           String?         @db.VarChar(20)   // QUICK, STANDARD, COMPREHENSIVE
  docUrl          String?         @db.VarChar(2000) // Optional external documentation URL
  context         String?         @db.Text          // Optional additional context from user

  // ... existing relations and indexes ...

  // New index for querying active retro-spec jobs per project
  @@index([projectId, command, status])
}
```

### No Changes to Project Model

The `Project` model does not need new fields. The presence/absence of a completed `RETRO_SPEC` job indicates whether specs have been generated. The board server component can check this when loading.

## Entity Relationships

```
Project (1) ──→ (N) ProjectSetupJob
  │                    ├── command: ONBOARD (existing)
  │                    └── command: RETRO_SPEC (new)
  │
  ├── configSyncedAt: DateTime?  (gate for setup → board redirect)
  └── setupJobs: ProjectSetupJob[]
```

## State Transitions

### ONBOARD Jobs (unchanged)
```
PENDING → RUNNING → COMPLETED → triggers syncProjectConfig()
PENDING → FAILED
RUNNING → FAILED
```

### RETRO_SPEC Jobs (new)
```
PENDING → RUNNING → COMPLETED (no config sync, badge shows "Specs ready")
PENDING → FAILED
RUNNING → FAILED
```

## Validation Rules

| Field | Rule |
|-------|------|
| `command` | Required. Enum: `ONBOARD` or `RETRO_SPEC` |
| `depth` | Required for RETRO_SPEC. One of: `QUICK`, `STANDARD`, `COMPREHENSIVE` |
| `docUrl` | Optional. Max 2000 chars. Must be valid URL if provided |
| `context` | Optional. Free text |
| `agent` | Required. Enum: `CLAUDE` or `CODEX` (existing) |

## Concurrency Guards

- **ONBOARD**: Max 1 active (PENDING/RUNNING) per project where `command = ONBOARD` AND `configSyncedAt IS NULL`
- **RETRO_SPEC**: Max 1 active (PENDING/RUNNING) per project where `command = RETRO_SPEC`
- ONBOARD and RETRO_SPEC jobs are independent — an active onboard does not block retro-spec and vice versa

## Migration Notes

- Default value `ONBOARD` for `command` ensures backward compatibility with existing rows
- Nullable `depth`, `docUrl`, `context` fields require no data migration
- New composite index `[projectId, command, status]` supports the scoped active-job query
