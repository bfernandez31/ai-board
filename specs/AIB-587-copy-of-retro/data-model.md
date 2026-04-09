# Data Model: Retro-Spec

**Feature Branch**: `AIB-587-copy-of-retro`

---

## New Enum: SpecDepth

```prisma
enum SpecDepth {
  QUICK
  STANDARD
  COMPREHENSIVE
}
```

**Purpose**: Controls the scope of generated specifications.

| Value | Output Scope |
|-------|-------------|
| QUICK | Single overview document (project purpose, structure) |
| STANDARD | Architecture + API endpoints + data model documents |
| COMPREHENSIVE | Full functional specs, technical specs, cross-references |

---

## New Model: SpecGenerationJob

```prisma
model SpecGenerationJob {
  id                Int             @id @default(autoincrement())
  projectId         Int
  agent             Agent
  depth             SpecDepth
  status            SetupJobStatus  @default(PENDING)

  // Optional inputs
  documentationUrl  String?         @db.VarChar(2000)
  additionalContext String?         @db.VarChar(5000)

  // Workflow tracking
  workflowRunId     BigInt?

  // Error tracking
  errorMessage      String?         @db.VarChar(2000)

  // Artifacts produced by workflow
  artifactSummary   Json?

  // Timestamps
  startedAt         DateTime?
  completedAt       DateTime?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  // Relations
  project           Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, status])
  @@index([projectId, createdAt(sort: Desc)])
}
```

**Design Notes**:
- Reuses `SetupJobStatus` enum (PENDING, RUNNING, COMPLETED, FAILED) — same lifecycle
- Reuses `Agent` enum (CLAUDE, CODEX) — same dispatch pattern
- `documentationUrl` max 2000 chars — sufficient for URLs
- `additionalContext` max 5000 chars — allows meaningful context without abuse
- `artifactSummary` stores JSON: `{ created: string[], depth: string, commitSha?: string }`
- Indexed on `[projectId, status]` for conflict guard queries
- Indexed on `[projectId, createdAt(sort: Desc)]` for "latest job" polling

**Validation Rules (Zod)**:
- `depth`: required, one of `QUICK | STANDARD | COMPREHENSIVE`
- `documentationUrl`: optional, valid URL format, max 2000 chars
- `additionalContext`: optional, max 5000 chars
- `agent`: required, one of `CLAUDE | CODEX`

---

## Modified Model: Project

Add field:

```prisma
model Project {
  // ... existing fields ...
  specsGeneratedAt    DateTime?
  // ... existing fields ...
  specGenerationJobs  SpecGenerationJob[]
}
```

**`specsGeneratedAt`**:
- Set when a `SpecGenerationJob` completes successfully (in the PATCH status callback)
- Null when specs have never been generated
- Used by board to decide whether to show the "no specs" banner
- Used by setup page to decide whether to show Step 2 or redirect to board

---

## State Transitions: SpecGenerationJob

```
PENDING → RUNNING    (workflow starts)
PENDING → FAILED     (dispatch failure or early error)
RUNNING → COMPLETED  (specs committed successfully)
RUNNING → FAILED     (generation or push error)
COMPLETED → COMPLETED (idempotent)
FAILED → FAILED      (idempotent)
```

**Side Effects on COMPLETED**:
- Set `project.specsGeneratedAt = now()` in the same status callback

**Conflict Guard**:
- Before creating a new job, check no existing job with status IN (PENDING, RUNNING) for the same project
- Return 409 with `JOB_ACTIVE` error code if conflict exists
