# Research: AIB-760 — Health Drawer Clickable Scan History + Visible Issue Counts

## Existing Files

### Components (to modify)

| File | Lines | Action | Notes |
|------|-------|--------|-------|
| `components/health/drawer/drawer-history.tsx` | 160 | **Modify heavily** | Core target: make rows interactive, add selected state, color-code issues, remove cost/tokens |
| `components/health/scan-detail-drawer.tsx` | 141 | **Modify** | Orchestrator: add `selectedScanId` state, wire callbacks, conditionally fetch historical report |
| `components/health/drawer/drawer-issues.tsx` | 357 | **No change** | Already renders all 6 report types via discriminated union — reused as-is |
| `components/health/drawer/drawer-header.tsx` | 106 | **No change** | Header always shows current module status |
| `components/health/drawer/score-trend-chart.tsx` | 54 | **No change** | Per FR-006: chart always shows full timeline regardless of selection |
| `components/health/drawer/drawer-tickets.tsx` | 57 | **No change** | Shows generated tickets for the displayed report |
| `components/health/drawer/drawer-states.tsx` | 98 | **No change** | State machine for non-standard states |

### Hooks (to modify or create)

| File | Lines | Action | Notes |
|------|-------|--------|-------|
| `app/lib/hooks/useScanReport.ts` | 42 | **Extend** | Add optional `scanId` parameter to fetch a specific historical scan's report |
| `app/lib/hooks/useHealthPolling.ts` | 22 | No change | Polling unaffected |
| `app/lib/hooks/useHealthTrends.ts` | 22 | No change | Trend data unaffected |

### API Routes (to modify)

| File | Lines | Action | Notes |
|------|-------|--------|-------|
| `app/api/projects/[projectId]/health/scans/route.ts` | 219 | **Modify GET** | Add optional `scanId` query param to fetch a single scan by ID with report |

### Types & Utilities (no change expected)

| File | Lines | Action | Notes |
|------|-------|--------|-------|
| `lib/health/types.ts` | 275 | **No change** | `ScanHistoryItem`, `ScanHistoryItemWithReport`, `ScanReport` already defined |
| `lib/health/report-schemas.ts` | 160 | No change | `parseScanReport()` already handles all 6 report types |
| `lib/health/format.ts` | 25 | No change | `formatCost`/`formatTokens` will no longer be imported by drawer-history |
| `lib/health/score-calculator.ts` | 53 | No change | Score color logic stays |
| `lib/quality-score.ts` | ~112 | No change | `getScoreColor()` and `getScoreLevel()` already available |

### Badge System (reuse as-is)

| File | Lines | Action | Notes |
|------|-------|--------|-------|
| `components/ui/badge.tsx` | 185 | **Reuse** | `variant="attribute" kind="friction" level={low|med|high}` maps perfectly to issue count thresholds |
| `app/globals.css` | ~440 | No change | `ab-level-low` (green), `ab-level-med` (yellow), `ab-level-high` (red) already defined |

### Existing Tests (to extend)

| File | Lines | Action | Notes |
|------|-------|--------|-------|
| `tests/unit/components/scan-detail-drawer.test.tsx` | 212 | **Extend** | Add tests for: selected scan state, historical report display, "Back to latest", "Report not available" |
| `tests/unit/components/drawer-issues.test.tsx` | 134 | No change | Already covers all 6 report types |
| `tests/unit/components/quality-gate-drawer.test.tsx` | 117 | No change | Separate drawer, unaffected |

### New Test Files

| File | Action | Notes |
|------|--------|-------|
| `tests/unit/components/drawer-history.test.tsx` | **Create** | No existing test file for DrawerHistory. Tests: row interaction, keyboard nav, issue count colors, cost/token removal, selected state, "Back to latest" |

## Patterns to Follow

### 1. Component Props + Callback Pattern (scan-detail-drawer.tsx)

The drawer orchestrator passes data down and receives events up via callbacks. `DrawerHistory` currently receives `{ projectId, moduleType }` — we extend with `{ selectedScanId, onSelectScan }`.

**Reference**: `scan-detail-drawer.tsx:69-134` — already passes `onTriggerScan` callback down to child components.

### 2. Badge Attribute System for Severity Colors (badge.tsx:112-117)

Issue count colors MUST use the existing `Badge` component with `variant="attribute"` and `kind="friction"`:
- `level="low"` → green (0 issues)
- `level="med"` → yellow (1-2 issues)
- `level="high"` → red (3+ issues)

**Reference**: `badge.tsx:112-117` (LEVEL_FRICTION_CLASS mapping), `globals.css` ab-level-* definitions.

**Why friction and not quality**: The spec explicitly states FR-008 requires `kind="friction"` with `low`/`med`/`high` levels. Friction semantics are correct: 0 issues = low friction (good), 3+ issues = high friction (bad).

### 3. useScanReport Hook Pattern (useScanReport.ts:15-42)

The hook fetches from `/api/projects/{projectId}/health/scans?type={moduleType}&limit=1&includeReport=true` and parses the report via `parseScanReport()`. For historical scan fetching, we follow the same pattern but add `scanId` to the query.

**Reference**: `useScanReport.ts:20-31` — fetch + parse pattern. `report-schemas.ts:137-158` — `parseScanReport()` safely handles null/invalid JSON.

### 4. API Route Extension Pattern (scans/route.ts:132-219)

The GET handler already accepts optional `type`, `status`, `limit`, `cursor`, `includeReport` query params via Zod validation. Adding `scanId` follows the same pattern: optional field in the Zod schema, conditional `where` clause in Prisma query.

**Reference**: `scans/route.ts:12-17` (scanHistorySchema), `scans/route.ts:168-171` (conditional where building).

### 5. Error Handling — API Dispatch-Then-Rollback (scans/route.ts:96-115)

When the POST handler's workflow dispatch fails, it rolls back the scan to FAILED status. Our GET enhancement is read-only so no rollback is needed, but we follow the same error propagation pattern: errors bubble up, never silently swallowed.

### 6. Test Mocking Pattern (scan-detail-drawer.test.tsx:9-11)

Tests mock hooks at module level with `vi.mock()` and use `mockReturnValue` per test:
```typescript
const mockUseScanReport = vi.fn();
vi.mock('@/app/lib/hooks/useScanReport', () => ({
  useScanReport: (...args: unknown[]) => mockUseScanReport(...args),
}));
```

**Reference**: `scan-detail-drawer.test.tsx:9-11`, uses `renderWithProviders` from `tests/utils/component-test-utils.tsx`.

### 7. Interactive Row Pattern (keyboard accessibility)

No existing clickable list rows in the health drawer. The pattern from the spec:
- Each row gets `role="button"`, `tabIndex={0}`, `aria-pressed={isSelected}`
- `onClick` handler + `onKeyDown` for Enter/Space
- Focus ring via Tailwind's `focus-visible:ring-2 focus-visible:ring-ring`
- Selected state via distinct background class (e.g., `ring-2 ring-primary/50 bg-primary/5`)

### 8. Drawer Reset on Close

`ScanDetailDrawer` receives `isOpen` state derived from `moduleType !== null` (line 41). When drawer closes and reopens, `moduleType` cycles null → value, naturally resetting any `useState` within the component. The `selectedScanId` state resets automatically.

**Reference**: `scan-detail-drawer.tsx:41,58` — `isOpen` derived from moduleType, Sheet controlled open state.

## Decisions

### D1: How to fetch a historical scan's report by ID

- **Decision**: Add optional `scanId` query parameter to the existing GET `/api/projects/{projectId}/health/scans` endpoint.
- **Rationale**: The endpoint already supports `includeReport=true`. Adding a `scanId` filter avoids creating a new route, keeps auth/validation in one place, and follows the spec assumption that "the existing API endpoint supports fetching the report for any specific scan by ID without requiring new backend routes."
- **Alternatives considered**:
  - New `/scans/[scanId]` route: More RESTful but adds a new file, duplicates auth logic, unnecessary for a single-use query.
  - Fetch all history with reports: Wasteful — reports can be large JSON blobs.

### D2: Where to hold `selectedScanId` state

- **Decision**: `useState<number | null>(null)` in `ScanDetailDrawer`, passed down to `DrawerHistory` and used to conditionally call `useScanReport`.
- **Rationale**: The drawer is the single orchestrator for all sub-components. Lifting state here allows both `DrawerHistory` (selection UI) and `DrawerIssues` (report display) to react to the same state without prop drilling through multiple layers.
- **Alternatives considered**:
  - URL state (searchParams): Over-engineering for a drawer that resets on close.
  - Context: Unnecessary — only two components need the state, parent → child is sufficient.

### D3: How to color-code issue counts

- **Decision**: Use `<Badge variant="attribute" kind="friction" level={getIssueCountLevel(issuesFound)}>` where `getIssueCountLevel` maps: 0→"low", 1-2→"med", 3+→"high".
- **Rationale**: FR-008 mandates using the unified badge system with `kind="friction"` levels. The friction semantic matches: 0 issues = low friction (green/good), 3+ = high friction (red/bad).
- **Alternatives considered**:
  - Direct CSS classes: Violates FR-008's requirement to use the badge system.
  - `kind="quality"`: Wrong semantic — quality has 4 tiers and inverted polarity.

### D4: How to handle "Back to latest"

- **Decision**: Render a small `<Button variant="ghost">` labeled "Back to latest" above the issues panel when `selectedScanId !== null`. Clicking sets `selectedScanId` to `null`.
- **Rationale**: Simple client-side state reset. No API call needed because the latest scan's report is already cached by `useScanReport`. FR-004/FR-005 requirements are met: visible only when historical scan is selected.
- **Alternatives considered**:
  - Badge on the latest row: Less discoverable, doesn't provide a clear action.
  - Auto-scroll to latest: Doesn't address the need to switch report content.

### D5: How to handle concurrent scan selection

- **Decision**: Each click sets `selectedScanId` immediately. If a previous fetch is in-flight, TanStack Query's `queryKey` change automatically cancels or ignores the stale response.
- **Rationale**: TanStack Query handles this natively — changing the queryKey means the old query's data won't update the component. No manual abort controller needed.
- **Alternatives considered**:
  - Manual AbortController: Unnecessary complexity given TanStack Query's behavior.
  - Debounced clicks: Adds latency to a fast operation.
