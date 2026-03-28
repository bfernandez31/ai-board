# Data Model: Health Dashboard

**Branch**: `AIB-370-health-dashboard-page` | **Date**: 2026-03-28

## Enums

### HealthScanType

Represents the type of health scan module.

| Value | Description | Contributes to Global Score |
|-------|-------------|----------------------------|
| `SECURITY` | Security vulnerability scanning | Yes (20%) |
| `COMPLIANCE` | Constitution/standards compliance checking | Yes (20%) |
| `TESTS` | Test coverage and passing analysis | Yes (20%) |
| `SPEC_SYNC` | Specification-to-code synchronization check | Yes (20%) |
| `QUALITY_GATE` | Derived from latest verify job quality score | Yes (20%) — passive |
| `LAST_CLEAN` | Last cleanup job date and result | No — informational only |

```prisma
enum HealthScanType {
  SECURITY
  COMPLIANCE
  TESTS
  SPEC_SYNC
}
```

> Note: `QUALITY_GATE` and `LAST_CLEAN` are not scannable types — they derive data from existing Job records. Only the 4 active types above are stored as HealthScan records.

### HealthScanStatus

Lifecycle states for a health scan execution.

```prisma
enum HealthScanStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

| Value | Description | Transitions To |
|-------|-------------|---------------|
| `PENDING` | Scan created, workflow dispatched | `RUNNING`, `FAILED` |
| `RUNNING` | Workflow executing scan | `COMPLETED`, `FAILED` |
| `COMPLETED` | Scan finished with results | Terminal |
| `FAILED` | Scan encountered an error | Terminal |

## Entities

### HealthScan

An individual scan execution record linked to a project and identified by scan type.

```prisma
model HealthScan {
  id          Int              @id @default(autoincrement())
  projectId   Int
  scanType    HealthScanType
  status      HealthScanStatus @default(PENDING)

  // Results
  score       Int?             // 0-100, null until COMPLETED
  report      String?          // JSON report data
  issuesFound Int?             // Count of issues discovered
  issuesFixed Int?             // Count of issues auto-fixed

  // Commit range (for incremental scanning)
  baseCommit  String?          @db.VarChar(40) // null = full scan
  headCommit  String?          @db.VarChar(40) // HEAD at scan time

  // Operational telemetry
  durationMs  Int?             // Scan execution duration
  tokensUsed  Int?             // AI tokens consumed
  costUsd     Float?           // Cost in USD

  // Error tracking
  errorMessage String?         @db.VarChar(2000)

  // Timestamps
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  // Relations
  project     Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, scanType, createdAt(sort: Desc)]) // Scan history per type
  @@index([projectId, scanType, status])                 // Concurrent scan check
  @@index([projectId, status])                           // Active scans for project
  @@index([createdAt])                                   // Cleanup/retention queries
}
```

**Validation rules**:
- `score`: 0-100 range, only set when status = COMPLETED
- `baseCommit` / `headCommit`: 40-char hex strings (Git SHA)
- `scanType`: Must be one of the 4 active types (SECURITY, COMPLIANCE, TESTS, SPEC_SYNC)
- Concurrent scan constraint: Only one PENDING/RUNNING scan per (projectId, scanType) — enforced at application level

**Incremental scanning logic**:
- First scan of a type: `baseCommit = null` (full scan)
- Subsequent scans: `baseCommit = headCommit` from latest COMPLETED scan of same type and project

### HealthScore

Cached aggregate health score per project. One record per project, upserted after each scan completion.

```prisma
model HealthScore {
  id              Int      @id @default(autoincrement())
  projectId       Int      @unique // One score record per project

  // Global aggregate
  globalScore     Int?     // 0-100, null if no modules scanned

  // Per-module sub-scores (null = never scanned)
  securityScore   Int?     // 0-100
  complianceScore Int?     // 0-100
  testsScore      Int?     // 0-100
  specSyncScore   Int?     // 0-100
  qualityGate     Int?     // 0-100, derived from latest verify job qualityScore

  // Last scan timestamps per type
  lastSecurityScan   DateTime?
  lastComplianceScan DateTime?
  lastTestsScan      DateTime?
  lastSpecSyncScan   DateTime?

  // Last Clean info (derived from Job model)
  lastCleanDate   DateTime?
  lastCleanJobId  Int?     // Reference to cleanup Job for display

  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
}
```

**Global score calculation**:
```
availableModules = [security, compliance, tests, specSync, qualityGate].filter(score !== null)
globalScore = sum(availableModules.map(m => m.score)) / availableModules.length
```
Equal weighting (20% each) with proportional redistribution when modules are missing.

**Validation rules**:
- `globalScore`: 0-100 range, null only when no modules have data
- All sub-scores: 0-100 range, null when never scanned
- `projectId`: Unique — exactly one HealthScore per project

### Project (modifications)

Add relations to the existing Project model:

```prisma
model Project {
  // ... existing fields ...

  // New relations
  healthScans   HealthScan[]
  healthScore   HealthScore?
}
```

## State Transitions

### HealthScan Lifecycle

```
[Create] → PENDING → RUNNING → COMPLETED
                  ↘          ↗
                    FAILED ←
```

1. **Create → PENDING**: API creates record, dispatches workflow
2. **PENDING → RUNNING**: Workflow callback updates status when scan starts
3. **RUNNING → COMPLETED**: Workflow callback with score, report, issues
4. **PENDING/RUNNING → FAILED**: Error during dispatch or execution

### Score Recalculation Trigger

After each scan reaches COMPLETED:
1. Read the new scan's score and type
2. Update the corresponding sub-score field in HealthScore
3. Update the last scan timestamp for that type
4. Recalculate `globalScore` from all non-null sub-scores
5. Upsert the HealthScore record

## Derived Data (No New Models)

### Quality Gate Module
- **Source**: `Job.qualityScore` from latest COMPLETED verify job for the project
- **Query**: `Job.findFirst({ where: { projectId, command: 'verify', status: 'COMPLETED', qualityScore: { not: null } }, orderBy: { completedAt: 'desc' } })`
- **Stored in**: `HealthScore.qualityGate`

### Last Clean Module
- **Source**: Latest COMPLETED cleanup job for the project
- **Query**: `Job.findFirst({ where: { projectId, command: 'clean', status: 'COMPLETED' }, orderBy: { completedAt: 'desc' } })`
- **Stored in**: `HealthScore.lastCleanDate` and `HealthScore.lastCleanJobId`
