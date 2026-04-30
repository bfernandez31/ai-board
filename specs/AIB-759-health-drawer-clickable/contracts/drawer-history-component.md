# Contract — `<DrawerHistory>` component (controlled)

## Props

```ts
interface DrawerHistoryProps {
  projectId: number;
  moduleType: HealthModuleType;
  /** id of the historic scan currently selected; null = latest scan implicit */
  selectedScanId: number | null;
  /** id of the latest (top-of-list) scan, used to disable "Latest" affordance */
  latestScanId: number | null;
  /** Called when the user clicks/Enter/Space on a row, OR clicks "Latest" */
  onSelect: (scanId: number | null) => void;
}
```

`selectedScanId`, `latestScanId`, `onSelect` are **new** props (controlled).

## Behavior

### History row (`<HistoryEntry>`)

- Outer element is a `<button type="button">` (D-004).
- `aria-pressed={scan.id === selectedScanId || (selectedScanId === null && scan.id === latestScanId)}` — the latest row is implicitly pressed when `selectedScanId === null`. This makes "open default state" feel correct to AT users.
- `onClick`: calls `onSelect(scan.id)`.
- Native `<button>` handles Enter/Space → `onClick` for free (FR-001, US4).

### Visual indicators when selected

| Indicator | Why it's needed | Where |
|-----------|-----------------|-------|
| `aurora-bg-selected` | Color cue | Outer button |
| `border-l-2 border-accent` | Non-color cue (FR-003) | Outer button |
| `font-medium` on the date `<p>` | Non-color cue | `<p className="text-xs text-foreground">` (when selected) |
| `aria-pressed="true"` | AT cue | Outer button |

### Removed elements

The following blocks at `drawer-history.tsx:115–135` are deleted:

- `<Tooltip>` block wrapping `Coins` icon + `formatCost(scan.costUsd)` (lines 115–125)
- `<Tooltip>` block wrapping `Zap` icon + `formatTokens(scan.tokensUsed)` (lines 126–135)

`Coins`, `Zap`, `formatCost`, `formatTokens` imports MUST be removed from the file. The `formatCost`/`formatTokens` functions in `lib/health/format.ts` stay (other consumers may exist).

### New element — friction badge

Replaces the existing plain `<span>` at lines 104–113 (`AlertTriangle` + `scan.issuesFound`):

```tsx
{scan.issuesFound !== null && (
  <Badge
    variant="attribute-tc"
    kind="friction"
    level={frictionLevelForIssueCount(scan.issuesFound)}
    aria-label={`${scan.issuesFound} issue${scan.issuesFound === 1 ? '' : 's'}`}
  >
    <AlertTriangle className="h-3 w-3" />
    {scan.issuesFound}
  </Badge>
)}
```

When the helper returns `null` (defensive: count is `null`), the badge is omitted. When the helper returns a level, Tailwind's purger sees the literal `attribute-tc` and `friction` strings (matches `LEVEL_FRICTION_CLASS` map at `components/ui/badge.tsx:112–117`).

### "Latest" affordance

Rendered next to the "Scan History" header label:

```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-1.5">
    <History className="h-3.5 w-3.5 text-muted-foreground" />
    <h4 className="text-sm font-medium text-foreground">Scan History</h4>
  </div>
  <Button
    variant="ghost"
    size="sm"
    className="text-xs h-6"
    onClick={() => onSelect(null)}
    disabled={selectedScanId === null}
    aria-label="Return to latest scan"
  >
    Latest
  </Button>
</div>
```

`disabled={selectedScanId === null}` implements FR-005's "disabled when latest is already selected".

## Interaction with parent (`ScanDetailDrawer`)

```tsx
const [selectedScanId, setSelectedScanId] = useState<number | null>(null);

useEffect(() => {
  setSelectedScanId(null);
}, [moduleType]);   // FR-004

const { data: latestData } = useScanReport(projectId, moduleType);
const { data: selectedData } = useScanById(projectId, moduleType, selectedScanId);

const displayedScan   = selectedScanId === null ? latestData?.scan   : selectedData?.scan;
const displayedReport = selectedScanId === null ? latestData?.report : selectedData?.report;
```

Existing render branches (`hasReport`, `hasCompletedScan && !hasReport`, etc.) are recomputed from `displayedScan` and `displayedReport`. The "no detailed report" empty state copy changes per FR-014:

```tsx
{hasCompletedScan && !hasReport && (
  <div className="text-center py-4">
    <p className="text-xs text-muted-foreground">
      {selectedScanId === null
        ? 'Report data unavailable — scan predates structured reporting'
        : 'No detailed report available for this scan'}
    </p>
  </div>
)}
```

Score Trend block (`<ScoreTrendChart data={trendData} />`) is unchanged — `trendData` is a prop that does not depend on `selectedScanId`, so the chart never re-renders on selection (FR-006 ✓).

## Test surface

In `tests/unit/components/drawer-history.test.tsx` (new file):

1. Renders one row per scan from the mocked infinite-query data.
2. **No `$` text and no token count text** appears in any row (FR-009, SC-005).
3. Row with `issuesFound = 0` renders a badge whose host element has class `ab-level-low` (friction-low).
4. Row with `issuesFound = 1` and `2` renders class `ab-level-med`.
5. Row with `issuesFound = 3` and `5` renders class `ab-level-high`.
6. Click on a non-latest row calls `onSelect(scan.id)` with the right id.
7. Pressing **Enter** on a focused row calls `onSelect(scan.id)` (US4).
8. Pressing **Space** on a focused row calls `onSelect(scan.id)` (US4).
9. When `selectedScanId === scan.id`, the row's `aria-pressed === "true"`.
10. "Latest" button is `disabled` when `selectedScanId === null`.
11. "Latest" button is enabled when `selectedScanId !== null`, and clicking it calls `onSelect(null)`.

In `tests/unit/components/scan-detail-drawer.test.tsx` (extend):

12. When a historic scan is "selected" via `useScanById` returning a different report, the rendered Issues section reflects that report (not the latest one).
13. When `selectedScanId !== null` and the selected scan's `report` is `null`, the empty-state copy is **"No detailed report available for this scan"** (not the legacy phrase).
14. Changing `moduleType` resets `selectedScanId` to `null` (assert via the "Latest" button being disabled after the change).
