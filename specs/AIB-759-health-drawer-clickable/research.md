# Research — AIB-759 Health drawer: clickable scan history + visible issue counts

## Decisions Resolved

### D-001 — How to fetch a historic scan's detailed report

- **Decision**: Add a new resource endpoint `GET /api/projects/:projectId/health/scans/:scanId` that returns `{ scan, report }` where `report` is the raw JSON column. A new TanStack Query hook (`useScanById`) wraps it. The existing `useScanReport(projectId, moduleType)` hook is kept as the source of truth for the "latest" scan and remains the seed when no historic row is selected.
- **Rationale**: REST-clean, matches the existing nested route style (`scans/:scanId/status` already exists). Lets us cache by `scanId` so rapid switching naturally settles on the latest-clicked one (TanStack Query keys per scanId; no race possible). Avoids overloading the list endpoint with `?id=` filters that would break the cursor semantics.
- **Alternatives considered**:
  - Add `?id=NNN` to existing `GET …/scans` — rejected: mixes single-resource lookup with pagination, weakens contract.
  - Extend `useScanReport` to accept `scanId` and reuse the list endpoint — rejected: forces `limit=1` plus an inequality filter and would still need a server change.

### D-002 — Where to keep the `selectedScanId` state

- **Decision**: Lift `selectedScanId: number | null` into `ScanDetailDrawer` (parent of both `DrawerIssues` and `DrawerHistory`). `null` means "show the latest scan" (current behavior). `DrawerHistory` becomes a controlled component receiving `selectedScanId`, `latestScanId`, and `onSelect(scanId | null)`.
- **Rationale**: `ScanDetailDrawer` already orchestrates fetching, rendering issues, tickets, and history. Lifting state is the smallest change that keeps the chart pinned (Score Trend stays in the parent and never re-keys). Resetting on `moduleType` change or close is a single `useEffect` in the parent.
- **Alternatives considered**:
  - Keep state inside `DrawerHistory` and use a callback to push the report up — rejected: leaks UI state across siblings, harder to reset on drawer open.
  - URL query param — rejected: drawer is a sibling sheet, no benefit from deep-linking historic scans for v1; adds router complexity.

### D-003 — Friction-level mapping for issue count

- **Decision**: Use `Badge variant="attribute-tc" kind="friction"` with `level` derived as: `0 → 'low'`, `1–2 → 'med'`, `3+ → 'high'`. Implement as a tiny pure helper `frictionLevelForIssueCount(count: number | null): 'low' | 'med' | 'high' | null` (returns `null` when count is `null` so the badge is omitted).
- **Rationale**: Matches FR-007 thresholds exactly. `attribute-tc` is the compact text-color variant — suitable for dense history rows where a full pill would be heavy. Confirms FR-008: zero new color tokens, all colors come from existing `ab-level-low|med|high` CSS classes already wired into the friction map.
- **Alternatives considered**:
  - `variant="attribute"` (full pill) — rejected: too visually heavy for tight rows.
  - Hardcoded `text-ctp-{green,yellow,red}` like `DrawerIssues` does — rejected: violates FR-008 / SC-004 (uses ctp tokens directly, not the unified badge palette which the spec explicitly requires).

### D-004 — Clickable row implementation

- **Decision**: Replace each history row's outer `<div>` with a `<button type="button">` styled to look identical, plus an inner `<div>` for layout. Use `aria-pressed={isSelected}` to expose selection state to AT, and add a non-color selection indicator (left border `border-l-2 border-accent` + `font-medium`) per FR-003. Native `<button>` gives Enter/Space/focus-ring for free (FR-001, FR-013, US4).
- **Rationale**: A `<button>` is the most accessible primitive — no manual `role`, `tabIndex`, or `onKeyDown` plumbing needed (matches the "shadcn primitives, no custom" rule). The constitution's "user behavior over implementation" testing rule maps cleanly: tests assert via `getByRole('button', { name: /…/ })`.
- **Alternatives considered**:
  - `<div role="button" tabIndex={0} onKeyDown>` — rejected: hand-rolling keyboard semantics is fragile and not justified when a native element exists.
  - shadcn `<Button>` — rejected: brings padding/typography presets that would conflict with the dense row design and force overrides.

### D-005 — "Latest" affordance shape

- **Decision**: Render a small `<Button variant="ghost" size="sm">` on the right of the "Scan History" header label. It is `disabled` (and visually inactive) when `selectedScanId === null` (i.e., the latest is implicitly current). Clicking sets `selectedScanId` back to `null`.
- **Rationale**: Spec auto-resolved decision (CONSERVATIVE) requires a discoverable, always-visible control. shadcn ghost button is the lightest option available without introducing a new variant.
- **Alternatives considered**:
  - Hidden until needed — rejected by the spec's auto-resolved decision.
  - Always-enabled "Latest" — rejected: violates FR-005 ("disabled when the latest scan is already selected").

### D-006 — Empty state when historic scan has no detailed report

- **Decision**: Reuse the existing copy slot in `ScanDetailDrawer` (lines 125–131 today: "Report data unavailable…"). When `selectedScanId !== null` and the fetched scan's report is null, show "No detailed report available for this scan." instead. Keep the same container styling.
- **Rationale**: One render path, one place to maintain. Matches FR-014 and SC-009 with the smallest possible change.
- **Alternatives considered**:
  - Auto-redirect to "Latest" — rejected: violates the auto-resolved CONSERVATIVE decision; users lose the explicit cue that *this* scan has no report.

### D-007 — Resetting selection on drawer reopen / module change

- **Decision**: A `useEffect` in `ScanDetailDrawer` resets `selectedScanId` to `null` whenever `moduleType` changes (this also covers reopening since `moduleType` toggles between `null` and a value).
- **Rationale**: Implements FR-004 directly. Single effect, single dependency.
- **Alternatives considered**:
  - Persist last selection per module — explicitly rejected by spec auto-resolved decision (predictable default, no stickiness for v1).

### D-008 — Race condition guard (FR-015)

- **Decision**: Rely on TanStack Query's per-`queryKey` deduplication: the query key for the selected scan is `['health', projectId, 'scan', scanId]`. When the user clicks a different row, the previous query stays cached but the rendered component reads from the new key — guaranteed "latest-clicked wins".
- **Rationale**: No manual sequence guards needed. Standard TanStack Query behavior. Validated by inspecting `useScanReport` and `DrawerHistory` which both rely on this same model.

---

## Existing Files

### Modify in place

| Path | What it covers | Action |
|------|----------------|--------|
| `components/health/scan-detail-drawer.tsx` | Drawer orchestrator: fetches latest scan, renders header + states + chart + issues + tickets + history | Lift `selectedScanId` state; pass to `DrawerHistory`; render report from selected scan when set, else from `useScanReport`; update empty-state copy |
| `components/health/drawer/drawer-history.tsx` | Renders Scan History list (infinite scroll), each row with date / commits / issues / cost / tokens / duration / score | Remove cost + token tooltips; replace plain `issuesFound` text with `Badge attribute-tc kind=friction`; convert row container to `<button>` with selection styling; accept `selectedScanId`, `latestScanId`, `onSelect` props; add "Latest" header button |
| `lib/health/types.ts` | Type definitions for HealthScan and reports | Add `frictionLevelForIssueCount` helper export (or add to a new local helper file under `lib/health/` — see implementation phases) |

### New files

| Path | Purpose |
|------|---------|
| `app/api/projects/[projectId]/health/scans/[scanId]/route.ts` | `GET` handler returning `{ scan, report }` for one scan |
| `app/lib/hooks/useScanById.ts` | TanStack Query hook keyed on `scanId`; consumed by `ScanDetailDrawer` when a historic row is selected |
| `lib/health/issue-friction.ts` | Pure helper `frictionLevelForIssueCount(count)` plus tests |
| `tests/unit/components/drawer-history.test.tsx` | New test file for clickability, selection state, friction badge, removed cost/token columns, "Latest" affordance, keyboard activation |
| `tests/unit/lib/health/issue-friction.test.ts` | Unit tests for the threshold helper |
| `tests/integration/health/scan-by-id.test.ts` | Integration test for the new `GET …/scans/:scanId` endpoint (auth, 404, found-with-report, found-without-report) |

### Extend (do not duplicate)

| Path | Why extend rather than create new |
|------|-----------------------------------|
| `tests/unit/components/scan-detail-drawer.test.tsx` | Already covers drawer orchestration. Add cases for: report swap when historic row selected, "Latest" returns to current, empty-state copy for missing-report historic scan, reset on moduleType change |

### Reference only (read for patterns; do not modify)

| Path | What pattern it provides |
|------|--------------------------|
| `components/ticket/inbox-analysis-panel.tsx:469–480` | Canonical `Badge variant="attribute" kind="friction"` usage |
| `components/ui/badge.tsx:112–117` | Friction → CSS class map; confirms `attribute-tc` is wired identically |
| `app/lib/hooks/useScanReport.ts` | Canonical pattern for fetching a scan + parsing report via `parseScanReport` |
| `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` | Sibling route that already enforces auth — copy auth pattern for the new GET route |
| `app/lib/query-keys.ts:74–82` | Where to register the new `health.scan(scanId)` key |
| `lib/health/report-schemas.ts` (referenced by `useScanReport`) | `parseScanReport(moduleType, raw)` parser to reuse server-side or in the new hook |

### Tests scanned (constitution: search FIRST)

Searched `tests/unit/components/`, `tests/unit/`, `tests/integration/` for files matching `health|scan|drawer`. Existing files:

- `tests/unit/components/scan-detail-drawer.test.tsx` — drawer orchestration (extend)
- `tests/unit/components/drawer-issues.test.tsx` — report rendering (untouched; report shape is unchanged)
- `tests/unit/components/health-module-card.test.tsx` — card (untouched)
- `tests/unit/components/health-review-quality.test.tsx` — module-specific (untouched)
- `tests/unit/components/quality-gate-drawer.test.tsx` — separate passive drawer; QUALITY_GATE is **not** in scope per `health-dashboard.tsx:107–111` (uses different drawer). Spec FR-012 calls out modules sharing the *active* drawer, so QUALITY_GATE is out of scope.
- `tests/integration/health/quality-gate-details.test.ts` — passive module (untouched)

No existing file covers `drawer-history` rendering specifically → new test file `drawer-history.test.tsx` is justified (constitution rule: "Create a new test file only when no existing file covers the domain").

---

## Patterns to Follow

### Pattern P-1 — Friction badge

**Reference**: `components/ticket/inbox-analysis-panel.tsx:469–480`

```tsx
<Badge
  variant="attribute"           // or "attribute-tc" for compact rows (D-003)
  kind="friction"
  level={toAttrLevel(frictionRisk)}
  data-testid="friction-risk-badge"
  aria-label={`Friction risk ${frictionRisk}`}
>
  {frictionRisk} friction
</Badge>
```

New code in `drawer-history.tsx` MUST use the same `variant="attribute-tc"` form (compact) with `kind="friction"`, level from the helper, and an `aria-label` so screen readers announce the count and severity. Do not introduce new ctp text colors for the count — they come from the badge variant only.

### Pattern P-2 — TanStack Query data fetching for a scan

**Reference**: `app/lib/hooks/useScanReport.ts:14–42`

The new `useScanById(projectId, moduleType, scanId)` hook MUST mirror this pattern:

- `cache: 'no-store'` on `fetch` — same as `useScanReport`.
- Throw on non-OK responses with `Error('HTTP ${status}: ${statusText}')`.
- Use `parseScanReport(moduleType, scan.report)` to decode the JSON column.
- `staleTime: 30_000`, `gcTime: 5 * 60 * 1000` — match the existing hook so cache pressure is consistent.
- `enabled: scanId !== null && moduleType !== null` — short-circuit when no historic row is selected.

### Pattern P-3 — API route auth

**Reference**: `app/api/projects/[projectId]/health/scans/route.ts:132–148` and `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`

The new `GET …/scans/:scanId` route MUST:

- Parse `projectId` and `scanId`, return 400 on invalid integer.
- Call `verifyProjectAccess(projectId, request)` (no workflow-token bypass needed — workflows don't read individual scans by id).
- Map `Unauthorized` → 401, `Project not found` → 403, generic catch → 500 with `console.error('[Health Scan By Id] Error:', error)`.
- Add a guard that the scan's `projectId` matches the URL `projectId` (defence in depth, prevents cross-project ID enumeration).

### Pattern P-4 — Selected-state visual indicator

**Reference**: constitution requires "non-color indicator" (FR-003).

The selected row uses both:

- Color: `aurora-bg-selected` (already defined at `globals.css:711`)
- Non-color: left border `border-l-2 border-accent` + `font-medium` on the date text + `aria-pressed="true"` on the button

This combination is verifiable in tests via `expect(button).toHaveAttribute('aria-pressed', 'true')` without depending on exact CSS classes.

### Pattern P-5 — Removing without breaking persistence (FR-009/FR-010)

The `Coins` and `Zap` icon imports plus the two `<Tooltip>` blocks at `drawer-history.tsx:115–135` are deleted. The API selector at `app/api/projects/[projectId]/health/scans/route.ts:178–195` is **left unchanged** — it still selects `costUsd` and `tokensUsed`. The fields stay in `ScanHistoryItem` (TypeScript) so any future consumer can read them. Do NOT remove from the Prisma schema, do NOT remove from the GET response, do NOT remove from `formatCost`/`formatTokens` utilities (other code may still call them). This is a render-only change.

### Pattern P-6 — Score Trend stays pinned (FR-006)

The `<ScoreTrendChart data={trendData} />` at `scan-detail-drawer.tsx:113` is rendered before the issue/report section and depends only on `trendData` (a prop, not on selected scan state). No change required — verifying this in tests is sufficient: assert the chart container or data prop does not re-render when `selectedScanId` toggles.

---

## Risk & Constraints

- **Performance (SC-008, <500 ms)**: Each row click triggers one fetch keyed by `scanId`; subsequent re-clicks within the same drawer session hit cache (30s `staleTime`). On a typical scan-by-id query (`SELECT * FROM HealthScan WHERE id = ?`), p95 should be <100 ms server-side. Network adds ~100–300 ms in dev. Comfortably under budget.
- **Security**: New endpoint reuses `verifyProjectAccess`. `scanId` is an integer FK — the project-id cross-check in P-3 prevents `…/projects/1/health/scans/9999` returning a scan from project 7.
- **Aurora theme**: All new visuals stay within existing aurora utility classes; no new tokens (SC-004 ✓).
- **No schema migration**: confirmed (FR-010, SC-005).
