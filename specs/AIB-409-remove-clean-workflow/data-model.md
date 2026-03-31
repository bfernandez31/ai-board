# Data Model: Remove Clean Workflow

**Feature**: AIB-409 | **Date**: 2026-03-31

## Overview

This feature **removes** database fields and modifies TypeScript types. No new tables or columns are added. The `CLEAN` value remains in the `WorkflowType` enum for historical data integrity.

## Schema Changes (Removals)

### Project model

| Field | Type | Action | Reason |
|-------|------|--------|--------|
| `activeCleanupJobId` | `Int?` | **DROP** | Cleanup locking no longer needed |
| Index on `activeCleanupJobId` | — | **DROP** | Column is removed |

### HealthScore model

| Field | Type | Action | Reason |
|-------|------|--------|--------|
| `lastCleanDate` | `DateTime?` | **DROP** | Last Clean module removed |
| `lastCleanJobId` | `Int?` | **DROP** | Last Clean module removed |

### WorkflowType enum

| Value | Action | Reason |
|-------|--------|--------|
| `FULL` | Keep | Active workflow |
| `QUICK` | Keep | Active workflow |
| `CLEAN` | **Keep** | Historical tickets reference this value |

## TypeScript Type Changes

### `lib/health/types.ts`

**Remove from `HealthModuleType` union**: `'LAST_CLEAN'`

**Before**: `HealthScanType | 'QUALITY_GATE' | 'LAST_CLEAN'`
**After**: `HealthScanType | 'QUALITY_GATE'`

**Remove from `ALL_MODULE_TYPES`**: `'LAST_CLEAN'` entry (6 → 5 items)

**Remove from `MODULE_METADATA`**: `LAST_CLEAN` key

**Remove from `HealthModuleStatus`**: `lastCleanDate`, `stalenessStatus`, `filesCleaned` fields

**Remove from `HealthResponse.modules`**: `lastClean` property

**Remove type**: `LastCleanReport` interface

**Remove from `ScanReport` union**: `LastCleanReport`

### No New Types

The COMPLIANCE scan's new categories ("Dead Code", "Temp Files") use the existing `ReportIssue` interface with its `category` field — no type changes needed.

## Migration SQL

```sql
-- Clear locks before dropping column
UPDATE "Project" SET "activeCleanupJobId" = NULL WHERE "activeCleanupJobId" IS NOT NULL;
DROP INDEX IF EXISTS "Project_activeCleanupJobId_idx";
ALTER TABLE "Project" DROP COLUMN "activeCleanupJobId";
ALTER TABLE "HealthScore" DROP COLUMN "lastCleanDate";
ALTER TABLE "HealthScore" DROP COLUMN "lastCleanJobId";
```

## Entities Preserved (No Change)

- **Ticket**: `workflowType` field still accepts `CLEAN` for historical records
- **HealthScan**: `HealthScanType` enum unchanged (does not include `LAST_CLEAN`)
- **HealthScore**: `globalScore`, all 5 sub-scores, and 4 scan timestamps remain
