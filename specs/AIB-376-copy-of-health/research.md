# Research: Health Dashboard Scan Detail Drawer

**Feature Branch**: `AIB-376-copy-of-health`
**Date**: 2026-03-29

---

## Research Topic 1: Scan Report Data Structure

**Question**: Is the `HealthScan.report` field structured enough to render per-issue details (severity, file paths, line numbers)?

**Finding**: The `report` field is `String?` storing markdown content. Scan workflows submit it via `PATCH /api/projects/:projectId/health/scans/:scanId/status` as a free-form string. There is no enforced schema for the report content.

**Decision**: Render the report as markdown using the existing `react-markdown` + `remark-gfm` pipeline (already used by `documentation-viewer.tsx` and `constitution-viewer.tsx`). The drawer will display the full markdown report as the "Issues" section content. Per-module grouping (FR-004) is achieved by the scan workflow already organizing its markdown output by module-specific categories (severity for Security, principles for Compliance, etc.). No new structured JSON field is needed for the MVP.

**Rationale**: Adding a parallel structured JSON field would require changes to all 4 scan workflows AND the status update API. The markdown report already contains the structured information — it's just formatted as markdown. Rendering it directly is the pragmatic path.

**Alternatives Considered**:
1. Add a `reportData: Json?` field to HealthScan — clean but requires scan workflow changes (out of scope)
2. Parse markdown into structured issues client-side — brittle, depends on consistent formatting
3. Render markdown as-is — chosen, leverages existing infrastructure

---

## Research Topic 2: Ticket-Scan Association Strategy

**Question**: How to show "Generated Tickets" when no direct FK exists between Ticket and HealthScan?

**Finding**: The Prisma schema has no `originScanId` or similar FK on Ticket. Tickets are project-level entities. Health scans are also project-level. The only indirect link is temporal (tickets created around scan completion time) or via the CLEAN workflow type.

**Decision**: For the MVP drawer, the "Generated Tickets" section will query tickets with `workflowType: 'CLEAN'` that were created after the scan's `completedAt` timestamp and before the next scan of the same type. This provides a reasonable heuristic without schema changes.

**Rationale**: Adding an `originScanId` FK to Ticket requires a Prisma migration and changes to the CLEAN workflow's ticket creation logic — both out of scope for a UI-only drawer feature. The temporal heuristic is sufficient for the initial release.

**Alternatives Considered**:
1. Add `originScanId: Int?` FK to Ticket model — cleanest but requires migration + workflow changes
2. Store generated ticket IDs in the scan report — requires scan workflow changes
3. Temporal heuristic query — chosen, zero schema changes needed

**Future Enhancement**: If precise ticket-scan linking is needed, add `originScanId` FK to Ticket in a dedicated ticket.

---

## Research Topic 3: Drawer Component Pattern

**Question**: What's the best pattern for the scan detail drawer using existing UI components?

**Finding**: The project has a well-established `Sheet` component (`components/ui/sheet.tsx`) built on Radix UI Dialog. It supports `side="right"` with animation. Existing usage examples:
- `ProjectComparisonLaunchSheet`: right-side, `max-w-xl`, `overflow-y-auto`
- `MobileMenu`: right-side navigation

The Sheet uses `aurora-bg-dialog` styling automatically.

**Decision**: Use the existing `Sheet` component with `side="right"` and a wider `max-w-2xl` class to accommodate detailed report content. The drawer will be controlled via React state in `HealthDashboard`, passed down as props.

**Rationale**: Reusing the existing Sheet component ensures design consistency, accessibility (Radix handles focus trap, Escape key, overlay click), and aurora theme compliance. No custom drawer implementation needed.

---

## Research Topic 4: Real-Time Updates While Drawer Is Open

**Question**: How to update drawer content when a scan completes while the drawer is open?

**Finding**: The `useHealthPolling` hook polls every 2s while active scans exist. The poll response includes module status updates. For the drawer, we also need the scan report content which is NOT included in the health polling response.

**Decision**: The drawer will use two data sources:
1. Module status from `useHealthPolling` (already active) — for score, status, issues count
2. A new `useScanReport` query that fetches the latest scan's report for the selected module — refetches when the module's scan status transitions to COMPLETED

**Rationale**: The health polling already detects scan completion. The drawer just needs to react to that state change by fetching the full report. This avoids adding report data to the polling payload (which would bloat every 2s response).

---

## Research Topic 5: Scan History Data Fetching

**Question**: Best approach for fetching and displaying scan history in the drawer?

**Finding**: The `GET /api/projects/:projectId/health/scans` endpoint already supports:
- `type` filter (per module type)
- `limit` parameter (1-100, default 20)
- Cursor-based pagination
- Returns: id, scanType, status, score, issuesFound, issuesFixed, baseCommit, headCommit, durationMs, errorMessage, startedAt, completedAt, createdAt

Query keys already defined: `queryKeys.health.scanHistory(projectId, type?)`

**Decision**: Use a `useQuery` hook with `queryKeys.health.scanHistory(projectId, moduleType)` to fetch the last 10 scans for the selected module. No pagination needed in the drawer (10 entries is sufficient for trend visibility per SC-004).

**Rationale**: The API and query key infrastructure already exist. Just need a thin hook wrapper.

---

## Research Topic 6: Card Click vs Button Click Separation

**Question**: How to make the card clickable (opens drawer) while keeping scan buttons functional (triggers scan)?

**Finding**: The current `HealthModuleCard` component has:
- Card wrapper: `<div>` with no click handler
- Scan button: `<Button onClick={onTriggerScan}>` inside the card

**Decision**: Add an `onClick` prop to `HealthModuleCard` for the card-level click. The scan `<Button>` already handles its own click. Add `e.stopPropagation()` to the scan button's `onClick` to prevent the card click from firing when clicking the button.

**Rationale**: Standard DOM event propagation handling. The button click stops propagation, so only direct card clicks open the drawer.

---

## Research Topic 7: Passive Module Drawer Content

**Question**: What to show for QUALITY_GATE and LAST_CLEAN modules that don't have HealthScan records?

**Finding**:
- **Quality Gate**: Derived from `Job.qualityScore` and `Job.qualityScoreDetails` on the latest COMPLETED verify job. No HealthScan record.
- **Last Clean**: Derived from the latest COMPLETED cleanup job. `HealthScore.lastCleanJobId` references the Job.

**Decision**: For passive modules, the drawer shows:
- **Quality Gate**: Fetch the latest verify job with quality score data. Display dimension breakdown from `qualityScoreDetails` JSON. Show recent SHIP tickets with their quality scores.
- **Last Clean**: Fetch the cleanup job referenced by `lastCleanJobId`. Display job summary, files cleaned count, and remaining issues.

Both use the existing Job API rather than the HealthScan history API.

**Rationale**: These modules don't produce HealthScan records, so the drawer must source data differently. The Job model already contains the needed information.
