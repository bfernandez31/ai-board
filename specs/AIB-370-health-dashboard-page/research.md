# Research: Health Dashboard

**Branch**: `AIB-370-health-dashboard-page` | **Date**: 2026-03-28

## Research Task 1: Global Score Calculation Strategy

**Question**: How should the global health score be calculated when not all modules have been scanned?

**Decision**: Proportional weight redistribution among scanned modules only.

**Rationale**: The spec (FR-015) explicitly requires that unscanned modules are excluded and weights are redistributed proportionally. With 5 modules at 20% each, if only 2 are scanned, each gets 50% weight. This avoids penalizing projects that haven't run all scan types yet.

**Alternatives considered**:
- Fixed weights with 0 for unscanned → Unfairly penalizes new projects
- Minimum scan requirement before showing score → Blocks initial adoption

**Implementation**: `globalScore = sum(moduleScore * moduleWeight) / sum(weights of scanned modules only)`. Pure function in `lib/health/score-calculator.ts`.

## Research Task 2: Scan Workflow Dispatch Pattern

**Question**: How should health scans dispatch GitHub workflows, and how do results flow back?

**Decision**: Reuse the existing workflow dispatch pattern (`Octokit.actions.createWorkflowDispatch`) with a new scan-specific workflow, and results flow back via a status callback endpoint (PATCH `/api/projects/[projectId]/health/scans/[scanId]/status`).

**Rationale**: The codebase already has `dispatch-ai-board.ts`, `dispatch-deploy-preview.ts`, and `dispatch-rollback-reset.ts` as patterns. Health scans follow the same pattern: create a DB record → dispatch workflow → workflow calls back with status/results. The callback endpoint mirrors the existing `PATCH /api/jobs/:id/status` pattern used for job status updates.

**Alternatives considered**:
- Polling GitHub Actions API for scan status → More complex, requires additional API calls, potential rate limiting
- WebSocket-based updates → Overkill for scan frequency, inconsistent with existing polling patterns

## Research Task 3: Real-Time Score Updates via Polling

**Question**: What polling strategy should be used for scan status and score updates?

**Decision**: 2-second polling while any scan is PENDING/RUNNING, disabled when all scans are terminal (matching existing `useJobPolling` pattern).

**Rationale**: The spec (Auto-Resolved Decision 2) explicitly chose 2s to match existing job polling. The `useJobPolling.ts` hook already implements the conditional polling pattern: `refetchInterval` returns `false` when all items are terminal, stopping unnecessary requests.

**Alternatives considered**:
- Server-Sent Events → Would require new infrastructure, inconsistent with codebase
- Longer polling interval (5-10s) → Spec explicitly chose 2s for consistency

## Research Task 4: Sidebar Navigation Integration

**Question**: How to add the Health entry to the sidebar navigation?

**Decision**: Add a new entry to `NAVIGATION_ITEMS` array in `components/navigation/nav-items.ts` with `{ id: 'health', label: 'Health', icon: HeartPulse, href: '/health', group: 'views' }`, positioned after the Comparisons entry.

**Rationale**: The existing navigation pattern uses a static array of `NavigationItem` objects filtered by group. The sidebar component (`icon-rail-sidebar.tsx`) automatically generates links as `/projects/${projectId}${item.href}`. HeartPulse is the icon specified in the spec (FR-001).

**Alternatives considered**:
- Dynamic navigation based on feature flags → Overengineered; all projects get Health
- Separate nav section for Health → Spec says "Views" group, after "Comparisons"

## Research Task 5: Score Color and Threshold Reuse

**Question**: Can existing score utilities be reused for health score display?

**Decision**: Reuse `getScoreThreshold()` and `getScoreColor()` from `lib/quality-score.ts` directly. The thresholds match exactly: Excellent (90-100), Good (70-89), Fair (50-69), Poor (0-49).

**Rationale**: The spec (FR-003) defines identical thresholds to those already implemented in `quality-score.ts`. The color mappings use Catppuccin semantic tokens (`text-ctp-green`, `text-ctp-blue`, `text-ctp-yellow`, `text-ctp-red`) which comply with the Aurora theme. No duplication needed.

**Alternatives considered**:
- New health-specific threshold utilities → Would duplicate existing code with identical logic
- Extended thresholds (5+ tiers) → Spec only defines 4 tiers, matching existing implementation

## Research Task 6: Concurrent Scan Prevention

**Question**: How to prevent concurrent scans of the same type for the same project?

**Decision**: Database-level check: before creating a new scan, query for existing PENDING/RUNNING scans of the same type and project. Return 409 Conflict if one exists.

**Rationale**: Simple and reliable. The scan creation endpoint checks `HealthScan.findFirst({ where: { projectId, scanType, status: { in: ['PENDING', 'RUNNING'] } } })` before creating. This is consistent with the existing `activeCleanupJobId` pattern on Project for preventing concurrent cleanups.

**Alternatives considered**:
- Database unique constraint on (projectId, scanType, status) → Complex partial unique index, harder to manage
- Optimistic locking with version field → Overengineered for this use case

## Research Task 7: HealthScore Cache Model Design

**Question**: Should the aggregate health score be stored or computed on-the-fly?

**Decision**: Store as a cached aggregate in a `HealthScore` model (one per project) updated after each scan completion, with on-the-fly recalculation as fallback.

**Rationale**: The spec (FR-013, FR-019) explicitly requires a cached aggregate that is updated after each scan. This enables fast page loads (SC-001: < 2s) without computing across all historical scans. The aggregate stores global score, per-module sub-scores, and last scan dates. The `score-calculator.ts` utility recalculates and upserts the `HealthScore` record whenever a scan completes.

**Alternatives considered**:
- Compute on every request from scan history → Slower for projects with many scans
- Materialized database view → PostgreSQL-specific, harder to manage in Prisma

## Research Task 8: Aurora Theme Application for Health Dashboard

**Question**: Which Aurora utility classes should be used for the Health Dashboard components?

**Decision**: Use existing aurora utility classes from `globals.css`:
- Hero zone: `aurora-bg-section` with `aurora-glow-score` for the global score
- Module cards: `aurora-glass` base with `aurora-glass-hover` for interaction
- Score-specific cards: `aurora-stat-green/blue/yellow/pink` based on score threshold
- Sub-score badges: `aurora-bg-subtle` with score-colored text

**Rationale**: The codebase has a rich set of Aurora utilities already defined. The analytics dashboard and comparison pages demonstrate usage patterns. No new CSS utilities are needed.

**Alternatives considered**:
- Custom gradient backgrounds → Violates constitution (compose shadcn/ui + existing utilities)
- Per-module custom colors → Aurora stat classes already cover the color spectrum
