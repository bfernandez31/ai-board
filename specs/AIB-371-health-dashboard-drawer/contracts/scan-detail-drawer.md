# Contract: Scan Detail Drawer Component

**Type**: UI Component Contract
**Consumer**: Health Dashboard page (`components/health/health-dashboard.tsx`)

## Component Interface

### ScanDetailDrawer

```typescript
interface ScanDetailDrawerProps {
  projectId: number;
  moduleType: HealthModuleType | null;    // null = drawer closed
  moduleStatus: HealthModuleStatus | null;
  isScanning: boolean;
  onClose: () => void;
  onTriggerScan?: () => void;
}
```

**Behavior**:
- Opens when `moduleType` is non-null
- Closes when `onClose` is called (overlay click, close button, or Escape key)
- Content adapts based on `moduleType` and scan status
- Fetches scan report and history data internally

### Drawer Sections

```
┌─────────────────────────────────────┐
│ [X] Close                           │
│                                     │
│ ┌─── Header ─────────────────────┐  │
│ │ [Icon] Module Name   [Score]   │  │
│ │ Last scan: date                │  │
│ │ Commits: base..head            │  │
│ └────────────────────────────────┘  │
│                                     │
│ ┌─── Issues (grouped) ──────────┐  │
│ │ ▼ High (3)                     │  │
│ │   • Issue description          │  │
│ │     file.ts:42                 │  │
│ │   • Issue description          │  │
│ │     file.ts:100                │  │
│ │ ▼ Medium (2)                   │  │
│ │   • ...                        │  │
│ └────────────────────────────────┘  │
│                                     │
│ ┌─── Generated Tickets ─────────┐  │
│ │ AIB-123 [INBOX]  →            │  │
│ │ AIB-124 [BUILD]  →            │  │
│ └────────────────────────────────┘  │
│                                     │
│ ┌─── History ────────────────────┐  │
│ │ 2026-03-28  Score: 85  3 issues│  │
│ │ 2026-03-25  Score: 78  5 issues│  │
│ │ [Load more]                    │  │
│ └────────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Data Fetching

### Latest Scan Report (New Query)

The drawer fetches the latest completed scan for the selected module to get the full `report` field.

**Query Key**: `['health', projectId, 'scan-report', moduleType]`

**Source**: `GET /api/projects/{projectId}/health/scans?type={scanType}&limit=1`

The existing scan history endpoint already returns scan records. The first result (when filtered by type, limit=1, and status=COMPLETED) provides the latest report.

**Note**: The existing `ScanHistoryItem` type does not include the `report` field. The scan history GET endpoint will need to be extended to optionally include the `report` field when a query parameter `includeReport=true` is passed, or a new endpoint/field is added.

### Scan History (Existing Query)

**Query Key**: `queryKeys.health.scanHistory(projectId, moduleType)`

**Source**: `GET /api/projects/{projectId}/health/scans?type={scanType}&limit=20&cursor={cursor}`

Uses existing cursor-based pagination. Returns `ScanHistoryItem[]` without `report` field (lightweight for list display).

## API Extension Required

### GET `/api/projects/{projectId}/health/scans`

**New Query Parameter**: `includeReport=true` (optional, boolean)

When `includeReport=true`, each scan in the response includes the `report` field. Default is `false` to keep history responses lightweight.

**Extended Response Type**:
```typescript
interface ScanHistoryItemWithReport extends ScanHistoryItem {
  report: string | null;
}
```

This avoids creating a new endpoint — the existing scan history handler adds a single optional field.

## Module-Specific Rendering Contract

Each module type maps to a rendering strategy:

| Module Type | Grouping Key | Group Display |
|------------|-------------|---------------|
| SECURITY | `severity` | High → Medium → Low with count per group |
| COMPLIANCE | `category` | Constitution principle name as group header |
| TESTS | Split arrays | "Auto-fixed" and "Non-fixable" sections |
| SPEC_SYNC | `status` | "Synced" and "Drifted" sections with drift detail |
| QUALITY_GATE | `dimensions` | Dimension name + score breakdown |
| LAST_CLEAN | N/A | Single summary section |
