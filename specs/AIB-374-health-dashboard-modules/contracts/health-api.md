# API Contract: Extended Health Endpoint

**Date**: 2026-03-29

## GET `/api/projects/{projectId}/health`

### Changes

The existing endpoint response is extended with `qualityGateDetail` and `lastCleanDetail` nested objects within the `modules` section. Existing fields remain unchanged for backward compatibility.

### Extended Response Schema

```typescript
interface HealthResponse {
  globalScore: number | null;
  label: string;
  color: { text: string; bg: string; fill: string };
  modules: {
    security: HealthModuleStatus;
    compliance: HealthModuleStatus;
    tests: HealthModuleStatus;
    specSync: HealthModuleStatus;
    qualityGate: QualityGateModuleStatus;   // EXTENDED
    lastClean: LastCleanModuleStatus;        // EXTENDED
  };
  lastFullScanDate: string | null;
  activeScans: ActiveScanInfo[];
}
```

### QualityGateModuleStatus (extended from HealthModuleStatus)

```typescript
interface QualityGateModuleStatus extends HealthModuleStatus {
  passive: true;
  // New fields
  ticketCount: number;
  trend: {
    type: 'improvement' | 'regression' | 'stable' | 'new' | 'no_data';
    delta: number | null;
    previousAverage: number | null;
  };
  distribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  // Drawer detail (inline to avoid separate fetch)
  detail: {
    dimensions: Array<{
      name: string;
      averageScore: number | null;
      weight: number;
    }>;
    recentTickets: Array<{
      ticketKey: string;
      title: string;
      score: number;
      label: string;
      completedAt: string;
    }>;
    trendData: Array<{
      week: string;
      averageScore: number;
      ticketCount: number;
    }>;
  } | null;
}
```

### LastCleanModuleStatus (extended from HealthModuleStatus)

```typescript
interface LastCleanModuleStatus extends HealthModuleStatus {
  passive: true;
  // Existing fields
  lastCleanDate: string | null;
  jobId: number | null;
  // New fields
  filesCleaned: number;
  remainingIssues: number;
  daysAgo: number | null;
  isOverdue: boolean;
  status: 'ok' | 'overdue' | 'never';
  // Drawer detail (inline to avoid separate fetch)
  detail: {
    summary: string;
    history: Array<{
      jobId: number;
      completedAt: string;
      filesCleaned: number;
      remainingIssues: number;
      summary: string;
      ticketKey: string | null;
    }>;
  } | null;
}
```

### Example Response (Quality Gate with data)

```json
{
  "globalScore": 78,
  "label": "Good",
  "color": { "text": "text-ctp-blue", "bg": "bg-ctp-blue/10", "fill": "bg-ctp-blue" },
  "modules": {
    "qualityGate": {
      "score": 75,
      "label": "Good",
      "lastScanDate": "2026-03-28T14:30:00.000Z",
      "passive": true,
      "summary": "5 tickets in 30 days",
      "ticketCount": 5,
      "trend": {
        "type": "improvement",
        "delta": 15,
        "previousAverage": 60
      },
      "distribution": {
        "excellent": 1,
        "good": 2,
        "fair": 1,
        "poor": 1
      },
      "detail": {
        "dimensions": [
          { "name": "Compliance", "averageScore": 82, "weight": 0.40 },
          { "name": "Bug Detection", "averageScore": 70, "weight": 0.30 },
          { "name": "Code Comments", "averageScore": 65, "weight": 0.20 },
          { "name": "Historical Context", "averageScore": 58, "weight": 0.10 },
          { "name": "Spec Sync", "averageScore": null, "weight": 0.00 }
        ],
        "recentTickets": [
          { "ticketKey": "AIB-350", "title": "Add user profile page", "score": 95, "label": "Excellent", "completedAt": "2026-03-28T14:30:00.000Z" },
          { "ticketKey": "AIB-348", "title": "Fix login redirect", "score": 82, "label": "Good", "completedAt": "2026-03-25T10:00:00.000Z" }
        ],
        "trendData": [
          { "week": "Mar 3-9", "averageScore": 60, "ticketCount": 2 },
          { "week": "Mar 10-16", "averageScore": 72, "ticketCount": 1 },
          { "week": "Mar 24-30", "averageScore": 80, "ticketCount": 2 }
        ]
      }
    },
    "lastClean": {
      "score": null,
      "label": "OK",
      "lastCleanDate": "2026-03-24T08:00:00.000Z",
      "passive": true,
      "jobId": 42,
      "summary": "5 days ago",
      "filesCleaned": 12,
      "remainingIssues": 2,
      "daysAgo": 5,
      "isOverdue": false,
      "status": "ok",
      "detail": {
        "summary": "Cleaned 12 files, resolved lint warnings and unused imports",
        "history": [
          { "jobId": 42, "completedAt": "2026-03-24T08:00:00.000Z", "filesCleaned": 12, "remainingIssues": 2, "summary": "Cleaned 12 files", "ticketKey": "AIB-340" },
          { "jobId": 35, "completedAt": "2026-02-20T10:30:00.000Z", "filesCleaned": 8, "remainingIssues": 0, "summary": "Cleaned 8 files", "ticketKey": "AIB-320" }
        ]
      }
    }
  }
}
```

### Example Response (empty state)

```json
{
  "modules": {
    "qualityGate": {
      "score": null,
      "label": null,
      "lastScanDate": null,
      "passive": true,
      "summary": "No qualifying tickets",
      "ticketCount": 0,
      "trend": { "type": "no_data", "delta": null, "previousAverage": null },
      "distribution": { "excellent": 0, "good": 0, "fair": 0, "poor": 0 },
      "detail": null
    },
    "lastClean": {
      "score": null,
      "label": null,
      "lastCleanDate": null,
      "passive": true,
      "jobId": null,
      "summary": "No cleanup yet",
      "filesCleaned": 0,
      "remainingIssues": 0,
      "daysAgo": null,
      "isOverdue": false,
      "status": "never",
      "detail": null
    }
  }
}
```

### Backward Compatibility

- All existing fields on `qualityGate` and `lastClean` module objects remain unchanged
- New fields are additive only
- Clients that don't read the new fields are unaffected
- `globalScore` calculation unchanged — still includes `qualityGate` score at equal weight with other modules
