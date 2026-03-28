# Data Model: Health Dashboard

**Feature**: AIB-375 — Health Dashboard
**Date**: 2026-03-28

## New Enums

### HealthScanType

Represents the type of health scan module.

| Value | Description | Module Type |
|-------|-------------|-------------|
| `SECURITY` | Security vulnerability scanning | Active |
| `COMPLIANCE` | Code compliance checks | Active |
| `TESTS` | Test coverage and quality | Active |
| `SPEC_SYNC` | Specification-to-code synchronization | Active |

> Quality Gate and Last Clean are **passive** modules — they do not create HealthScan records. Their data is derived from existing Job model data.

### HealthScanStatus

Lifecycle status of a health scan execution.

| Value | Description | Terminal? |
|-------|-------------|-----------|
| `PENDING` | Scan created, workflow dispatch pending | No |
| `RUNNING` | Workflow executing scan | No |
| `COMPLETED` | Scan finished successfully with score | Yes |
| `FAILED` | Scan failed with error | Yes |

## New Models

### HealthScan

Represents a single execution of a health scan for one module type within a project.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `Int` | PK, autoincrement | Unique identifier |
| `projectId` | `Int` | FK → Project.id, NOT NULL | Owning project |
| `scanType` | `HealthScanType` | NOT NULL | Module being scanned |
| `status` | `HealthScanStatus` | NOT NULL, default: PENDING | Current lifecycle state |
| `score` | `Int?` | 0-100, nullable | Computed score (null until COMPLETED) |
| `report` | `Json?` | nullable | Structured JSON findings from scan |
| `issuesFound` | `Int` | default: 0 | Number of issues detected |
| `issuesFixed` | `Int` | default: 0 | Number of issues auto-fixed |
| `baseCommit` | `String?` | VarChar(40), nullable | Previous scan's head commit (null = full scan) |
| `headCommit` | `String?` | VarChar(40), nullable | Current commit being scanned |
| `ticketsCreated` | `Int` | default: 0 | Number of tickets created from findings |
| `errorMessage` | `String?` | VarChar(2000), nullable | Error details when FAILED |
| `durationMs` | `Int?` | nullable | Scan execution duration |
| `inputTokens` | `Int?` | nullable | AI tokens consumed |
| `outputTokens` | `Int?` | nullable | AI tokens generated |
| `costUsd` | `Float?` | nullable | Total cost in USD |
| `startedAt` | `DateTime?` | nullable | When scan execution began |
| `completedAt` | `DateTime?` | nullable | When scan finished |
| `createdAt` | `DateTime` | default: now() | Record creation timestamp |
| `updatedAt` | `DateTime` | @updatedAt | Last update timestamp |

**Indexes**:
- `@@index([projectId, scanType, createdAt(sort: Desc)])` — List scans by type, newest first
- `@@index([projectId, status])` — Find active scans for concurrent prevention
- `@@index([projectId, scanType, status])` — Optimized concurrent scan check

**Relationships**:
- `project: Project` — Many-to-one (via projectId FK, onDelete: Cascade)

**Validation Rules**:
- `score` must be 0-100 when present
- `baseCommit`/`headCommit` are 40-char hex strings (SHA-1) when present
- `status` transitions: PENDING → RUNNING → COMPLETED|FAILED (enforced at application level)

---

### HealthScore

Cached aggregate health score for a project. One record per project (unique on projectId).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `Int` | PK, autoincrement | Unique identifier |
| `projectId` | `Int` | FK → Project.id, UNIQUE, NOT NULL | Owning project (one-to-one) |
| `globalScore` | `Int?` | 0-100, nullable | Weighted average of sub-scores (null if no scans) |
| `securityScore` | `Int?` | 0-100, nullable | Latest Security scan score |
| `complianceScore` | `Int?` | 0-100, nullable | Latest Compliance scan score |
| `testsScore` | `Int?` | 0-100, nullable | Latest Tests scan score |
| `specSyncScore` | `Int?` | 0-100, nullable | Latest Spec Sync scan score |
| `qualityGateScore` | `Int?` | 0-100, nullable | Derived from Job qualityScore averages |
| `lastScanAt` | `DateTime?` | nullable | Most recent scan completion across all types |
| `lastSecurityScanAt` | `DateTime?` | nullable | Last Security scan completion |
| `lastComplianceScanAt` | `DateTime?` | nullable | Last Compliance scan completion |
| `lastTestsScanAt` | `DateTime?` | nullable | Last Tests scan completion |
| `lastSpecSyncScanAt` | `DateTime?` | nullable | Last Spec Sync scan completion |
| `lastCleanAt` | `DateTime?` | nullable | Most recent completed cleanup job date |
| `lastCleanJobId` | `Int?` | nullable | Reference to most recent cleanup Job |
| `createdAt` | `DateTime` | default: now() | Record creation timestamp |
| `updatedAt` | `DateTime` | @updatedAt | Last update timestamp |

**Indexes**:
- `@@unique([projectId])` — One health score per project (enforced)
- `@@index([projectId])` — Fast lookup by project

**Relationships**:
- `project: Project` — One-to-one (via projectId FK, onDelete: Cascade)

**Validation Rules**:
- All score fields: 0-100 when present, null when no data available
- `globalScore` computed as weighted average of non-null contributing scores (20% each, redistributed)

## Model Relationships Diagram

```
Project (existing)
├── 1:N  HealthScan[]     — scan history per module type
├── 1:1  HealthScore?     — cached aggregate score
├── 1:N  Ticket[]         — existing
├── 1:N  Job[]            — existing (via Ticket) — used by passive modules
└── ...

HealthScan
├── N:1  Project          — owning project

HealthScore
├── 1:1  Project          — owning project
```

## Prisma Schema Additions

```prisma
enum HealthScanType {
  SECURITY
  COMPLIANCE
  TESTS
  SPEC_SYNC
}

enum HealthScanStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

model HealthScan {
  id             Int              @id @default(autoincrement())
  projectId      Int
  scanType       HealthScanType
  status         HealthScanStatus @default(PENDING)
  score          Int?
  report         Json?
  issuesFound    Int              @default(0)
  issuesFixed    Int              @default(0)
  baseCommit     String?          @db.VarChar(40)
  headCommit     String?          @db.VarChar(40)
  ticketsCreated Int              @default(0)
  errorMessage   String?          @db.VarChar(2000)
  durationMs     Int?
  inputTokens    Int?
  outputTokens   Int?
  costUsd        Float?
  startedAt      DateTime?
  completedAt    DateTime?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, scanType, createdAt(sort: Desc)])
  @@index([projectId, status])
  @@index([projectId, scanType, status])
}

model HealthScore {
  id                  Int       @id @default(autoincrement())
  projectId           Int       @unique
  globalScore         Int?
  securityScore       Int?
  complianceScore     Int?
  testsScore          Int?
  specSyncScore       Int?
  qualityGateScore    Int?
  lastScanAt          DateTime?
  lastSecurityScanAt  DateTime?
  lastComplianceScanAt DateTime?
  lastTestsScanAt     DateTime?
  lastSpecSyncScanAt  DateTime?
  lastCleanAt         DateTime?
  lastCleanJobId      Int?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
}
```

**Project model additions** (add to existing model):
```prisma
model Project {
  // ... existing fields ...
  healthScans  HealthScan[]
  healthScore  HealthScore?
}
```

## State Transitions

### HealthScan Status Lifecycle

```
PENDING ──→ RUNNING ──→ COMPLETED
                    └──→ FAILED
```

- **PENDING → RUNNING**: Set by workflow callback when scan execution begins
- **RUNNING → COMPLETED**: Set by workflow callback with score, report, and issue counts
- **RUNNING → FAILED**: Set by workflow callback with errorMessage
- No reverse transitions allowed
- Terminal states: COMPLETED, FAILED
