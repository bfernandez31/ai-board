# Data Model: Capture and Display Agent Execution Logs

**Branch**: `AIB-721-copy-of-capture` | **Date**: 2026-04-23

## New Enum: LogStatus

```prisma
enum LogStatus {
  NONE       // No log captured (pre-feature jobs, capture failures)
  AVAILABLE  // Log content is available for viewing
  PRUNED     // Log content removed by retention policy; job telemetry preserved
}
```

**State transitions**: `NONE → AVAILABLE` (on log upload), `AVAILABLE → PRUNED` (on retention pruning). No reverse transitions.

## New Model: JobLog

```prisma
model JobLog {
  id          Int      @id @default(autoincrement())
  jobId       Int      @unique
  agentType   String   @db.VarChar(20)    // CLAUDE, CODEX, MISTRAL, GEMINI
  rawContent  String   @db.Text           // Full raw agent output (pre-normalization)
  entries     String   @db.Text           // JSON array of NormalizedLogEntry[]
  entryCount  Int                         // Number of entries (avoid JSON parse for counts)
  rawSize     Int                         // Original output size in bytes (before truncation)
  truncated   Boolean  @default(false)    // Whether output was truncated due to size limit
  createdAt   DateTime @default(now())

  job         Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
  @@index([createdAt])                    // For retention pruning queries
}
```

**Design rationale**:
- Separate table avoids bloating Job queries (FR-004). Timeline API and job polling never join to this table.
- `@unique` on `jobId` enforces one log per job.
- `onDelete: Cascade` — deleting a job removes its log.
- `rawContent` stores the original agent output for debugging; `entries` stores the normalized JSON.
- `createdAt` index enables efficient pruning of records older than 30 days.

## Modified Model: Job

```prisma
model Job {
  // ... existing fields unchanged ...

  // New fields for log feature
  logStatus   LogStatus @default(NONE)
  logSummary  String?   @db.Text          // Condensed preview for timeline inline display

  // New relation
  jobLog      JobLog?

  // Repurpose: existing `logs` field (line 36) is dropped — replaced by logSummary + JobLog
  // Migration: ALTER TABLE "Job" DROP COLUMN "logs" (safe — field is NULL for all rows)
}
```

**Field details**:
- `logStatus`: Drives UI behavior — NONE hides log actions, AVAILABLE shows preview + "View full logs", PRUNED shows "Logs expired" message.
- `logSummary`: Short text (<2KB) embedded in the job record. Generated server-side from normalized entries. Contains error summary for FAILED jobs, key milestones for COMPLETED jobs.
- Dropping `logs`: The existing `logs` column is unused (NULL for all rows in production). Replacing it with `logSummary` and `logStatus` provides clearer semantics.

## TypeScript Types

### NormalizedLogEntry

```typescript
interface NormalizedLogEntry {
  timestamp: string;          // ISO 8601
  eventType: LogEventType;
  content: string;            // Human-readable content
  metadata?: Record<string, unknown>;  // Agent-specific extra data (tool name, exit code, etc.)
}

type LogEventType =
  | 'message'            // Agent text output / reasoning
  | 'tool_invocation'    // Tool use (Edit, Write, Bash, etc.)
  | 'tool_result'        // Tool output / return value
  | 'error'              // Error message or stack trace
  | 'status_change';     // Status/phase transitions
```

### JobLogResponse (GET /api/jobs/:id/logs)

```typescript
interface JobLogResponse {
  jobId: number;
  agentType: string;
  entries: NormalizedLogEntry[];
  entryCount: number;
  rawSize: number;
  truncated: boolean;
  createdAt: string;          // ISO 8601
}
```

### LogUploadPayload (POST /api/jobs/:id/logs)

```typescript
interface LogUploadPayload {
  agentType: 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI';
  rawOutput: string;          // Full agent stdout capture
}
```

## Validation Rules

| Field | Constraint | Matches DB |
|-------|-----------|------------|
| `agentType` | One of: CLAUDE, CODEX, MISTRAL, GEMINI | `@db.VarChar(20)` |
| `rawOutput` | Max 5MB (5,242,880 bytes) | `@db.Text` (unlimited, app-enforced) |
| `logSummary` | Max 2,000 characters (generated server-side) | `@db.Text` (app-enforced) |
| `entryCount` | Non-negative integer | `Int` |
| `rawSize` | Non-negative integer | `Int` |

## Relationships

```
Job (1) ←→ (0..1) JobLog
  - One job has at most one log record
  - JobLog.jobId is unique foreign key to Job.id
  - Cascade delete: removing a job removes its log
  - Pruning removes JobLog record + sets Job.logStatus = PRUNED, Job.logSummary = null
```

## Migration Notes

1. Add `LogStatus` enum to schema
2. Add `JobLog` model
3. Add `logStatus` (default NONE) and `logSummary` to Job
4. Add `jobLog` relation to Job
5. Drop `logs` column from Job (unused, safe)
6. Run `bunx prisma generate` to regenerate client
