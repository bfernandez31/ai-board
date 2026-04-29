# Implementation Plan: AIB-760 — Health Drawer Clickable Scan History + Visible Issue Counts

**Branch**: `AIB-760-health-drawer-clickable`
**Spec**: `specs/AIB-760-health-drawer-clickable/spec.md`
**Created**: 2026-04-29

## Technical Context

| Aspect | Detail |
|--------|--------|
| **Primary component** | `components/health/drawer/drawer-history.tsx` (160 lines) — scan history list |
| **Orchestrator** | `components/health/scan-detail-drawer.tsx` (141 lines) — drawer shell |
| **Data hook** | `app/lib/hooks/useScanReport.ts` (42 lines) — fetches latest scan + report |
| **API endpoint** | `app/api/projects/[projectId]/health/scans/route.ts` (219 lines) — GET with pagination |
| **Badge system** | `components/ui/badge.tsx` — `variant="attribute" kind="friction" level={low|med|high}` |
| **Types** | `lib/health/types.ts` — `ScanHistoryItem`, `ScanHistoryItemWithReport`, `ScanReport` |
| **Report parser** | `lib/health/report-schemas.ts` — `parseScanReport()` with Zod validation |
| **Database** | `prisma/schema.prisma` — `HealthScan` model (no migration needed) |

### Dependencies

- `@tanstack/react-query` v5 — already used for data fetching and caching
- `shadcn/ui Badge` — already used throughout the app
- No new dependencies required

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. TypeScript-First** | PASS | All new code uses strict TypeScript with explicit types. New `getIssueCountLevel` helper fully typed. |
| **II. Component-Driven** | PASS | Extends existing shadcn/ui components (Badge, Button). No custom styling from scratch. Client Component directive already present. Feature-based folder structure maintained. |
| **III. Test-Driven** | PASS | Extends `scan-detail-drawer.test.tsx` for orchestrator tests. Creates `drawer-history.test.tsx` for new interactive behavior. Uses RTL query priority (getByRole > getByText). |
| **IV. Security-First** | PASS | `scanId` validated via Zod. `verifyProjectAccess` ensures scan belongs to authenticated project. No new user input surfaces beyond existing validated params. |
| **V. Database Integrity** | PASS | No schema changes. Read-only query addition. No migrations needed. |
| **V. Spec Guardrails** | PASS | Auto-resolved decisions documented in spec with trade-offs. All used CONSERVATIVE fallback. |

### Gate Evaluation

- No constitution violations detected.
- No NEEDS CLARIFICATION items remain (all resolved in research.md).

## Design Artifacts

- `specs/AIB-760-health-drawer-clickable/research.md` — existing files, patterns, decisions
- `specs/AIB-760-health-drawer-clickable/data-model.md` — entities, state model, relationships
- `specs/AIB-760-health-drawer-clickable/contracts/api-scan-history.md` — API contract changes

## Implementation Phases

### Phase 1: API Enhancement (backend, no UI impact)

**File**: `app/api/projects/[projectId]/health/scans/route.ts`

1. Add `scanId: z.coerce.number().int().positive().optional()` to `scanHistorySchema` (line 12-17)
2. In the GET handler, when `scanId` is present:
   - Query `prisma.healthScan.findFirst({ where: { id: scanId, projectId }, select: { ...allFields, report: true } })`
   - Return `{ scans: [result], nextCursor: null, hasMore: false }` (or empty array if not found)
   - Skip the existing pagination logic
3. When `scanId` is absent: existing behavior unchanged

**Pattern reference**: Follow the conditional where-building pattern at `scans/route.ts:168-171`.

### Phase 2: Hook Enhancement (data layer)

**File**: `app/lib/hooks/useScanReport.ts`

1. Add optional third parameter `scanId: number | null = null` to `useScanReport`
2. Include `scanId` in the query key: `['health', projectId, 'scan-report', moduleType, scanId]`
3. When `scanId` is provided, append `&scanId=${scanId}` to the fetch URL (along with existing `includeReport=true`)
4. When `scanId` is null, fetch latest (existing behavior: `limit=1`)
5. Parse response identically via `parseScanReport()`

**Pattern reference**: Follow the existing fetch+parse pattern at `useScanReport.ts:20-36`.

### Phase 3: Issue Count Helper (utility)

**File**: `components/health/drawer/drawer-history.tsx` (inline helper, not exported)

1. Add `getIssueCountLevel` function:
   ```typescript
   function getIssueCountLevel(issuesFound: number | null): 'low' | 'med' | 'high' {
     const count = issuesFound ?? 0;
     if (count === 0) return 'low';
     if (count <= 2) return 'med';
     return 'high';
   }
   ```

This maps to the Badge system's friction kind: 0=green, 1-2=yellow, 3+=red (FR-007, FR-008).

### Phase 4: DrawerHistory — Interactive Rows (core UI)

**File**: `components/health/drawer/drawer-history.tsx`

#### 4a. New Props

Extend `DrawerHistoryProps`:
```typescript
interface DrawerHistoryProps {
  projectId: number;
  moduleType: HealthModuleType;
  selectedScanId: number | null;
  latestScanId: number | null;
  onSelectScan: (scanId: number | null) => void;
}
```

#### 4b. Make Rows Interactive (FR-001, FR-010)

Transform `HistoryEntry` from a passive `<div>` to an interactive element:
- Add `role="button"`, `tabIndex={0}`, `aria-pressed={isSelected}`
- Add `onClick={() => onSelect(scan.id)}` handler
- Add `onKeyDown` handler for Enter and Space (FR-001)
- Add `cursor-pointer` class
- Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none` for keyboard focus indicator (FR-010)

#### 4c. Selected State Visual (FR-003)

When `scan.id === selectedScanId`:
- Add `ring-2 ring-primary/50 bg-primary/5` classes to the row
- This provides both color AND non-color distinction (border + background), satisfying WCAG SC 1.4.1 (SC-006)

#### 4d. Issue Count Badge Colors (FR-007, FR-008)

Replace the plain `<span>` issue count display with:
```tsx
<Badge variant="attribute" kind="friction" level={getIssueCountLevel(scan.issuesFound)}>
  {scan.issuesFound ?? 0}
</Badge>
```

#### 4e. Remove Cost/Token Display (FR-009)

Delete the `costUsd` and `tokensUsed` tooltip blocks (lines 115-136 in current file). Remove `Coins` and `Zap` icon imports. Remove `formatCost` and `formatTokens` imports.

Remaining row metrics: date, commit range, issue count (colored), duration, score.

#### 4f. "Back to Latest" Control

Add a "Back to latest" button rendered above the history list when `selectedScanId !== null && selectedScanId !== latestScanId`:
```tsx
{selectedScanId !== null && selectedScanId !== latestScanId && (
  <Button variant="ghost" size="sm" onClick={() => onSelectScan(null)}>
    ← Back to latest
  </Button>
)}
```

Hidden when latest scan is active (FR-005). Keyboard-accessible by default (it's a Button).

### Phase 5: ScanDetailDrawer — Orchestration (wiring)

**File**: `components/health/scan-detail-drawer.tsx`

1. Add state: `const [selectedScanId, setSelectedScanId] = useState<number | null>(null)`
2. Pass `selectedScanId` to `useScanReport(projectId, moduleType, selectedScanId)` (Phase 2 enhancement)
3. Derive `latestScanId` from the first scan in `DrawerHistory`'s data, or from the initial `useScanReport` call when no selection is made. Pragmatically: pass the latest scan ID from the initial hook result.
4. Pass `selectedScanId`, `latestScanId`, and `onSelectScan={setSelectedScanId}` to `DrawerHistory`
5. When `selectedScanId` is set and the fetched report is null, show "Report not available for this scan" (FR-012)
6. Reset: `selectedScanId` naturally resets because `moduleType` cycles to null on close, and the component re-renders with fresh state on reopen

### Phase 6: Score Trend Chart (no change verification)

**File**: `components/health/drawer/score-trend-chart.tsx` — NO CHANGES

Per FR-006: the chart always displays the full timeline regardless of which scan is selected. The chart receives `trendData` from the parent, which is independent of `selectedScanId`. Verify this is the case and no accidental coupling exists.

## Testing Strategy

### Unit Tests — DrawerHistory (NEW file)

**File**: `tests/unit/components/drawer-history.test.tsx`

Following constitution §III test selection: React component with user interactions → Vitest + RTL component test.

| Test | Verifies |
|------|----------|
| Renders scan rows with date, commits, duration, score | Baseline rendering |
| Does NOT render cost or token values | FR-009 |
| Issue count badge shows green for 0 issues | FR-007 |
| Issue count badge shows yellow for 1-2 issues | FR-007 |
| Issue count badge shows red for 3+ issues | FR-007 |
| Null issuesFound treated as 0 (green) | Edge case |
| Clicking a row calls onSelectScan with scan ID | FR-001 |
| Pressing Enter on focused row calls onSelectScan | FR-001, FR-010 |
| Pressing Space on focused row calls onSelectScan | FR-001, FR-010 |
| Selected row has distinct visual (aria-pressed, ring class) | FR-003 |
| Rows are focusable via Tab (tabIndex=0) | FR-010 |
| "Back to latest" button visible when non-latest selected | FR-004 |
| "Back to latest" button hidden when latest is active | FR-005 |
| Clicking "Back to latest" calls onSelectScan(null) | FR-004 |
| Badge uses `kind="friction"` (not hardcoded colors) | FR-008 |

**Mocking**: Mock `useInfiniteQuery` to return controlled scan data. Use `renderWithProviders` + `userEvent`.

### Unit Tests — ScanDetailDrawer (EXTEND existing file)

**File**: `tests/unit/components/scan-detail-drawer.test.tsx`

| Test | Verifies |
|------|----------|
| Shows "Report not available for this scan" when historical scan has null report and selectedScanId is set | FR-012 |
| Passes selectedScanId to useScanReport hook | Wiring |

**Mocking**: Extend existing `mockUseScanReport` mock to verify `scanId` argument.

### Integration Tests (if needed)

The API change (adding `scanId` param) is minimal and follows existing patterns. If existing scan history integration tests exist, extend them. Otherwise, the Zod validation and Prisma query are well-covered by unit tests.

### No E2E Tests

Per constitution: E2E is expensive (~5s each), default to integration. This feature has no browser-only requirements (no OAuth, drag-drop, viewport-dependent behavior). RTL component tests with userEvent adequately cover keyboard interaction.

## Implementation Order & Dependencies

```
Phase 1 (API) ──────────────────────┐
                                     ├── Phase 5 (Orchestration)
Phase 2 (Hook) ─────────────────────┘        │
                                              │
Phase 3 (Helper) ───┐                        │
                     ├── Phase 4 (UI) ────────┘
                     │
Phase 6 (Verify no-change) ── parallel with any phase
```

- Phases 1+2 can run in parallel (no shared files)
- Phase 3 is trivial (inline helper), can be done with Phase 4
- Phase 4 depends on Phase 3 (helper) and requires Phase 5 props contract
- Phase 5 depends on Phases 1, 2, 4 (wires everything together)
- Phase 6 is verification only

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Large report JSON blobs slow down historical scan fetch | Reports are already fetched for the latest scan; historical fetch is identical. No new performance concern. |
| Badge `kind="friction"` visual not matching spec expectations | Using the exact system specified in FR-008. Visual verified via existing badge usage in inbox analysis. |
| Keyboard focus ring not visible on dark theme | Using Tailwind's `ring-ring` token which adapts to theme. Consistent with other focusable elements. |
| State not resetting when drawer reopens | `moduleType` cycles null→value on close/open; React re-initializes `useState`. Verified via existing pattern at `scan-detail-drawer.tsx:41`. |
