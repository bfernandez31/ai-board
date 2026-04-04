# Data Model: Add SKIPPED Status for Health Scans

**Date**: 2026-04-04
**Branch**: `AIB-534-add-skipped-status`

## Entity Changes

### HealthScanStatus (Enum — Modified)

**Current values**: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`
**New value**: `SKIPPED`

**State transitions (updated)**:
```
PENDING  → RUNNING | FAILED | SKIPPED
RUNNING  → COMPLETED | FAILED | SKIPPED
COMPLETED → (terminal)
FAILED    → (terminal)
SKIPPED   → (terminal)
```

SKIPPED is a terminal state — no further transitions allowed.

### HealthScan (Model — Behavior Change Only)

No schema changes. When status is SKIPPED:
- `score`: MUST be `null`
- `report`: MAY contain a brief JSON explanation (e.g., `{"reason": "0 qualifying PRs found"}`)
- `completedAt`: Set to current timestamp (scan is finished)
- `issuesFound`: `null` or `0`
- `durationMs`, `tokensUsed`, `costUsd`: Set if available (the scan did execute briefly)

### HealthScore (Model — Behavior Change Only)

No schema changes. When a scan completes with SKIPPED status:
- The HealthScore aggregate is NOT updated
- Per-module score field retains its previous value
- Per-module lastScan timestamp is NOT updated
- `globalScore` is NOT recalculated

This means:
- A module that was previously scored at 85 and then SKIPPED still shows 85
- A module that has never been scanned and gets SKIPPED stays null
- The global score remains at its previous value

## Validation Rules

| Rule | Enforcement Point |
|------|-------------------|
| Score must be null for SKIPPED | Status PATCH endpoint (Zod + explicit check) |
| Score must be present for COMPLETED | Status PATCH endpoint (existing) |
| SKIPPED is terminal | `VALID_TRANSITIONS` map in status route |
| COMPLIANCE never SKIPPED | Workflow logic (scan agent always runs) |
| TESTS_FIX never SKIPPED | Workflow logic (0 failures = score 100) |

## Migration

### Prisma Migration

```sql
ALTER TYPE "HealthScanStatus" ADD VALUE 'SKIPPED';
```

**Rollback note**: PostgreSQL does not support `ALTER TYPE ... DROP VALUE`. If rollback is needed, the SKIPPED value remains in the enum but is never written — harmless.

**No data migration**: Per Decision 3 in the spec, existing records are not modified.
