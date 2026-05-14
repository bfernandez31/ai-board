# Data Model: Admin Insights Page Cosmetic Refresh & Failed Report Diagnostics

**Branch**: `AIB-807-admin-insights-page`
**Date**: 2026-05-14

---

## No Schema Changes Required

This feature does NOT require Prisma schema changes or database migrations. All data already exists in the schema; the changes are purely at the API serialization and UI layers.

---

## Existing Entities (unchanged)

### InsightsReport

Source of truth: `prisma/schema.prisma` — `InsightsReport` model.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `Int` (PK, autoincrement) | — |
| `status` | `InsightsRunStatus` (RUNNING/COMPLETED/FAILED) | Default: RUNNING |
| `generatedAt` | `DateTime` | When the run was initiated |
| `periodStart` | `DateTime` | Analysis window lower bound (inclusive) |
| `periodEnd` | `DateTime` | Analysis window upper bound (exclusive) |
| `sessionsCount` | `Int?` | Populated on COMPLETED |
| `ticketsCount` | `Int?` | Populated on COMPLETED |
| `artifactKey` | `String?` | Blob storage key, excluded from API responses |
| `artifactSize` | `Int?` | Artifact bytes |
| `errorReason` | `String?` | Set on FAILED (max 500 chars) |
| `jobId` | `Int?` (unique FK → Job) | Linked workflow job |
| `completedAt` | `DateTime?` | Terminal state timestamp |
| `createdAt` | `DateTime` | Row creation time |
| `updatedAt` | `DateTime` | Auto-updated |

### Job (linked)

| Field | Type | Relevance |
|-------|------|-----------|
| `id` | `Int` (PK) | — |
| `workflowRunId` | `BigInt?` | **Key field** — GitHub Actions run ID, set on RUNNING transition (first-write-wins) |
| `command` | `String` | `'insights-analyze'` for insights jobs |
| `projectId` | `Int` (FK → Project) | Host project for GitHub owner/repo resolution |

---

## DTO Changes

### `ReportListEntry` (extended)

File: `app/lib/insights/repository.ts`

**New fields**:

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `workflowRunId` | `string \| null` | `InsightsReport.job.workflowRunId` (BigInt → string) | Serialized as string for JSON safety |
| `githubActionsUrl` | `string \| null` | Computed server-side from `workflowRunId` + host project `owner/repo` | `null` when workflowRunId absent or project config unavailable |

**`toListEntry()` changes**: Must accept the Prisma result with `include: { job: { select: { workflowRunId: true } } }` and compute `githubActionsUrl` using the host project's `githubOwner`/`githubRepo` from environment variables.

### Trigger Request Body (extended)

File: `app/api/admin/insights/trigger/route.ts`

**New optional fields**:

| Field | Type | Notes |
|-------|------|-------|
| `periodStart` | `string` (ISO 8601) | When present, overrides computed periodStart (retry use case) |
| `periodEnd` | `string` (ISO 8601) | When present, overrides computed periodEnd (retry use case) |

**Validation**: Both must be present together or both absent. `periodStart < periodEnd`. Both must parse as valid ISO dates. Zod schema enforcement.

---

## State Transitions

No new transitions. Retry creates a **new** InsightsReport+Job pair following the existing RUNNING → COMPLETED/FAILED lifecycle.

```
Failed Report ──(retry click)──→ POST /trigger { periodStart, periodEnd }
                                       │
                                       ▼
                              New InsightsReport (RUNNING)
                              + New Job (PENDING)
                                       │
                                       ▼
                              Workflow dispatch
                                       │
                              ┌────────┴────────┐
                              ▼                 ▼
                          COMPLETED           FAILED
```
