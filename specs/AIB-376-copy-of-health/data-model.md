# Data Model: Health Dashboard Scan Detail Drawer

**Feature Branch**: `AIB-376-copy-of-health`
**Date**: 2026-03-29

---

## Existing Entities (No Schema Changes)

This feature is UI-only. All data comes from existing models — no Prisma migration needed.

### HealthScan (existing — source of truth for scan reports)

| Field | Type | Usage in Drawer |
|-------|------|-----------------|
| id | Int | Unique scan identifier |
| projectId | Int | Project FK |
| scanType | HealthScanType | Module type filter |
| status | HealthScanStatus | Determines drawer state (PENDING/RUNNING/COMPLETED/FAILED) |
| score | Int? | Score badge display |
| report | String? | Main report content (rendered as markdown) |
| issuesFound | Int? | Issues count display |
| issuesFixed | Int? | Fixed issues count |
| baseCommit | String? | Commit range start |
| headCommit | String? | Commit range end |
| durationMs | Int? | Scan duration |
| errorMessage | String? | Error display for FAILED state |
| startedAt | DateTime? | Scan timing |
| completedAt | DateTime? | Scan timing |
| createdAt | DateTime | History ordering |

### HealthScore (existing — aggregate module status)

| Field | Usage in Drawer |
|-------|-----------------|
| securityScore, complianceScore, testsScore, specSyncScore | Current scores per module |
| qualityGate | Quality gate score |
| lastSecurityScan, lastComplianceScan, lastTestsScan, lastSpecSyncScan | Last scan dates |
| lastCleanDate | Last cleanup date |
| lastCleanJobId | FK to cleanup Job |

### Job (existing — source for passive module data)

| Field | Usage in Drawer |
|-------|-----------------|
| qualityScore | Quality Gate dimension score |
| qualityScoreDetails | JSON string with dimension breakdown |
| status | Job completion status |
| command | Filter by `verify` or `clean` |

### Ticket (existing — generated tickets display)

| Field | Usage in Drawer |
|-------|-----------------|
| ticketKey | Display in generated tickets list |
| title | Display in generated tickets list |
| currentStage | Stage badge display |

---

## New TypeScript Interfaces (Client-Side Only)

### ScanDetailDrawerProps

```typescript
interface ScanDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  moduleType: HealthModuleType;
  moduleStatus: HealthModuleStatus;
  isScanning: boolean;
}
```

### ScanReportResponse (new API response shape)

```typescript
interface ScanReportResponse {
  scan: {
    id: number;
    scanType: HealthScanType;
    status: HealthScanStatus;
    score: number | null;
    report: string | null;
    issuesFound: number | null;
    issuesFixed: number | null;
    baseCommit: string | null;
    headCommit: string | null;
    durationMs: number | null;
    errorMessage: string | null;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
}
```

### GeneratedTicketItem

```typescript
interface GeneratedTicketItem {
  id: number;
  ticketKey: string;
  title: string;
  currentStage: string;
}
```

### QualityGateDetail (for passive Quality Gate module)

```typescript
interface QualityGateDetail {
  job: {
    id: number;
    qualityScore: number | null;
    qualityScoreDetails: string | null;
    completedAt: string | null;
  } | null;
  recentTickets: GeneratedTicketItem[];
}
```

### LastCleanDetail (for passive Last Clean module)

```typescript
interface LastCleanDetail {
  job: {
    id: number;
    status: string;
    completedAt: string | null;
    command: string;
  } | null;
}
```

---

## Data Flow

```
HealthDashboard (existing)
  │
  ├── useHealthPolling(projectId)  ← module status + active scans
  │
  └── ScanDetailDrawer (new)
        │
        ├── useScanReport(projectId, moduleType)  ← latest scan report
        │     └── GET /api/projects/:id/health/scans/:scanId
        │
        ├── useScanHistory(projectId, moduleType)  ← scan history list
        │     └── GET /api/projects/:id/health/scans?type=X&limit=10
        │
        └── useGeneratedTickets(projectId, scanId)  ← linked tickets
              └── GET /api/projects/:id/health/scans/:scanId/tickets
```

---

## State Transitions (Drawer Content)

```
Module State          Drawer Content
─────────────         ──────────────
never_scanned    →    Header + "No scans yet" message + CTA
scanning         →    Header + progress indicator + "Scan in progress"
completed        →    Header + Report (markdown) + Generated Tickets + History
failed           →    Header + error message + error logs
```
