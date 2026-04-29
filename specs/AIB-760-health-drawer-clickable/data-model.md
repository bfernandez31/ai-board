# Data Model: AIB-760 — Health Drawer Clickable Scan History

## Entities

### Existing Entities (no schema changes)

#### HealthScan (Prisma model — source of truth: `prisma/schema.prisma:557-594`)

Already contains all fields needed. No migration required.

| Field | Type | Relevance |
|-------|------|-----------|
| `id` | `Int @id` | Used as `selectedScanId` to identify which historical scan is active |
| `scanType` | `HealthScanType` | Filter scans by module type |
| `status` | `HealthScanStatus` | Only COMPLETED scans have viewable reports |
| `score` | `Int?` | Displayed in score badge per row |
| `report` | `String?` | JSON blob parsed by `parseScanReport()` — the report displayed in issues panel |
| `issuesFound` | `Int?` | Color-coded with friction badge (0→green, 1-2→yellow, 3+→red) |
| `baseCommit` | `String?` | Displayed as commit range |
| `headCommit` | `String?` | Displayed as commit range |
| `durationMs` | `Int?` | Displayed in row |
| `costUsd` | `Float?` | **Persisted but removed from UI display** (FR-009) |
| `tokensUsed` | `Int?` | **Persisted but removed from UI display** (FR-009) |
| `completedAt` | `DateTime?` | Used as display date |
| `createdAt` | `DateTime` | Fallback display date |

### New Client-Side State

#### SelectedScanState

Pure client-side `useState` in `ScanDetailDrawer`. Not persisted.

```typescript
// In ScanDetailDrawer component
const [selectedScanId, setSelectedScanId] = useState<number | null>(null);
```

| Field | Type | Description |
|-------|------|-------------|
| `selectedScanId` | `number \| null` | ID of the currently selected historical scan. `null` = latest scan (default). Resets to `null` when drawer closes. |

**State transitions**:
- Drawer opens → `null` (show latest)
- User clicks/activates a non-latest row → `scanId` (show historical)
- User clicks "Back to latest" → `null`
- User clicks the already-latest row → `null` (no-op, already showing latest)
- Drawer closes → state destroyed (component unmounts or moduleType becomes null)

## Validation Rules

### Issue Count Level Mapping

```typescript
function getIssueCountLevel(issuesFound: number | null): 'low' | 'med' | 'high' {
  const count = issuesFound ?? 0;  // null/undefined treated as 0
  if (count === 0) return 'low';   // green
  if (count <= 2) return 'med';    // yellow
  return 'high';                    // red
}
```

- Applies uniformly to ALL health module types (FR-011)
- `null`/`undefined` issuesFound treated as 0 (edge case from spec)

### ScanId Query Parameter

```typescript
// Added to scanHistorySchema in scans/route.ts
scanId: z.coerce.number().int().positive().optional()
```

- When present: returns single scan matching `{ id: scanId, projectId }` with report
- When absent: existing pagination behavior unchanged
- Authorization: same `verifyProjectAccess` check — scanId must belong to the authenticated project

## Relationships

```
ScanDetailDrawer (orchestrator)
├── selectedScanId: number | null        ← state
├── useScanReport(projectId, moduleType, selectedScanId)  ← data
│   └── fetches from GET /health/scans?scanId=X&includeReport=true
├── DrawerHeader          (reads moduleStatus — unaffected)
├── DrawerIssues          (reads report from useScanReport — switches with selection)
├── DrawerTickets         (reads report — switches with selection)
├── ScoreTrendChart       (reads trendData — always full timeline, FR-006)
└── DrawerHistory
    ├── props: selectedScanId, onSelectScan, latestScanId
    ├── renders: interactive rows with Badge friction colors
    └── emits: onSelectScan(scanId | null)
```
