# Health Models

## Health Models

### HealthScan

An individual scan execution record linked to a project and identified by scan type. Tracks the full lifecycle from PENDING through COMPLETED, FAILED, or SKIPPED. Stores the commit range analyzed (enabling incremental scanning), scan results, and operational telemetry.

```prisma
model HealthScan {
  id           Int              @id @default(autoincrement())
  projectId    Int
  scanType     HealthScanType
  status       HealthScanStatus @default(PENDING)

  score        Int?             // 0-100, null until COMPLETED; always null for SKIPPED
  report       String?          // JSON report data
  issuesFound  Int?
  issuesFixed  Int?

  baseCommit   String?          @db.VarChar(40) // null = full scan
  headCommit   String?          @db.VarChar(40) // HEAD at scan time

  durationMs   Int?
  tokensUsed   Int?
  costUsd      Float?
  errorMessage String?          @db.VarChar(2000)

  startedAt    DateTime?
  completedAt  DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  project      Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, scanType, createdAt(sort: Desc)])
  @@index([projectId, scanType, status])
  @@index([projectId, status])
  @@index([createdAt])
}
```

**Incremental scanning**: The first scan of a type sets `baseCommit = null` (full scan). Subsequent scans set `baseCommit` to the `headCommit` of the latest COMPLETED scan of the same type for that project.

**Concurrent scan constraint**: Only one PENDING or RUNNING scan per `(projectId, scanType)` is allowed. Enforced at application level (409 on conflict).

**Validation**: `score` is set only when `status = COMPLETED`; `score` must be null when `status = SKIPPED`; `scanType` is limited to the 5 active types (SECURITY, COMPLIANCE, TESTS, SPEC_SYNC, REVIEW_QUALITY).

**SKIPPED behavior**: When a scan agent detects nothing to evaluate, it writes `skipped: true` and `skipReason` in the result file. The workflow maps this to SKIPPED status. COMPLIANCE and TESTS scans are never SKIPPED regardless of agent output. SKIPPED is a terminal state — no further transitions allowed.

---

### HealthScore

Cached aggregate health score per project (one record per project). Stores the computed global score and individual sub-scores for each of the 5 contributing modules. Upserted after every successful scan completion within the same database transaction as the `HealthScan` status update, ensuring consistency between the two tables.

```prisma
model HealthScore {
  id               Int       @id @default(autoincrement())
  projectId        Int       @unique

  globalScore      Int?      // 0-100, null if no modules scanned

  securityScore    Int?
  complianceScore  Int?
  testsScore       Int?
  specSyncScore    Int?
  qualityGate      Int?      // derived from latest verify job qualityScore
  reviewQualityScore Int?

  lastSecurityScan    DateTime?
  lastComplianceScan  DateTime?
  lastTestsScan       DateTime?
  lastSpecSyncScan    DateTime?
  lastReviewQualityScan DateTime?

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  project          Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
}
```

**Global score calculation**:
```
availableModules = [security, compliance, tests, specSync, qualityGate, reviewQuality].filter(score !== null)
globalScore = sum(availableModules.map(m => m.score)) / availableModules.length
```

Equal weighting with proportional redistribution when modules are unscanned or SKIPPED. The `HealthScore` aggregate is NOT updated when a scan reaches SKIPPED status — the previous COMPLETED sub-score (if any) is preserved.

**Derived fields**:
- `qualityGate`: Latest COMPLETED verify job's `qualityScore` for the project

---

### ProjectSetupJob

Represents a single setup attempt for a project — either an initial onboarding run or a retro-spec generation run. Multiple records per project form a retry history; the most recent active job of each command type determines the project's setup state.

```prisma
model ProjectSetupJob {
  id              Int             @id @default(autoincrement())
  projectId       Int
  agent           Agent
  status          SetupJobStatus  @default(PENDING)
  command         SetupJobCommand @default(ONBOARD)

  // Retro-spec specific inputs (nullable, only for RETRO_SPEC jobs)
  depth           SetupJobDepth?
  docUrl          String?         @db.VarChar(2000)
  context         String?         @db.Text

  workflowRunId   BigInt?
  errorMessage    String?         @db.VarChar(2000)
  artifactSummary Json?
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  project         Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, status])
  @@index([projectId, createdAt(sort: Desc)])
  @@index([projectId, command, status])
}
```

**Fields**:
- `id`: Auto-incrementing unique identifier
- `projectId`: Parent project (required, cascade delete)
- `agent`: Selected agent CLI (`CLAUDE`, `CODEX`, or `MISTRAL`)
- `status`: Current job state (default: `PENDING`)
- `command`: Job type discriminator (default: `ONBOARD`). `RETRO_SPEC` identifies spec generation jobs.
- `depth`: Spec generation depth level — `SetupJobDepth` enum: `QUICK`, `STANDARD`, or `COMPREHENSIVE` (RETRO_SPEC only; null for ONBOARD)
- `docUrl`: Optional URL of external documentation to incorporate (RETRO_SPEC only; max 2000 chars)
- `context`: Optional additional context for spec generation (RETRO_SPEC only)
- `workflowRunId`: GitHub Actions workflow run ID (set on first RUNNING callback)
- `errorMessage`: Error details persisted on failure (max 2000 chars)
- `artifactSummary`: JSON record of job outputs. Shape: `{ created: string[], preserved: string[], missing: string[], partial: boolean, commitSha?: string, errorCode?: string }`. `preserved` lists files that already existed and were not overwritten (e.g., `CLAUDE.md`). `partial: true` indicates Phase 2 failed and only Phase 1 outputs were committed. `errorCode` is set to `GUIDANCE_GENERATION_FAILED` on partial success, or `CONFIG_GENERATION_FAILED` / `COMMIT_FAILED` on full failure.
- `startedAt`: Set when status transitions to `RUNNING`
- `completedAt`: Set when status transitions to any terminal state
- `createdAt`: Record creation time
- `updatedAt`: Last modification time

**Relationships**:
- Belongs to Project (required, cascade delete)

**Constraints**:
- Composite index on `(projectId, status)` for fast active-job lookups
- Composite index on `(projectId, createdAt DESC)` for fast latest-job queries
- Composite index on `(projectId, command, status)` for command-scoped active-job lookups

**Business Rules**:
- Only one job with PENDING or RUNNING status is permitted per project **per command type** at a time — ONBOARD and RETRO_SPEC jobs do not block each other
- `ONBOARD` jobs require `configSyncedAt` to be null; `RETRO_SPEC` jobs require `configSyncedAt` to be set
- `agent` determines which credential provider is required (`CLAUDE` → `ANTHROPIC`, `CODEX` → `OPENAI`, `MISTRAL` → `MISTRAL`)
- On COMPLETED (ONBOARD), `syncProjectConfig()` runs automatically (non-blocking) to set `configSyncedAt`
- On COMPLETED (RETRO_SPEC), no config sync — generated specs are committed to the repository by the workflow
- If config sync fails after an ONBOARD COMPLETED, the job remains COMPLETED but `configSyncedAt` stays null — the setup page remains visible and the user can retry

---

