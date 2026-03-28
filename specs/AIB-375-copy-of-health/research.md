# Research: Health Dashboard

**Feature**: AIB-375 — Health Dashboard
**Date**: 2026-03-28

## Research Tasks & Findings

### R1: Global Score Calculation — Weighted Average with Missing Modules

**Decision**: Use equal weighting (20% each) across 5 contributing modules, redistributing weight proportionally when modules have no scans.

**Rationale**: The spec mandates equal weighting. When only N of 5 modules have scores, each contributes `1/N` weight. This avoids penalizing projects that haven't run all scan types yet. Example: 2 modules scanned → each contributes 50%.

**Alternatives considered**:
- Fixed 20% with 0 for unscanned → Punishes new projects unfairly
- Skip global score until all modules scanned → Reduces value for partially-scanned projects
- Configurable weights per project → Over-engineering for initial release (noted for future iteration in spec)

**Implementation**: Pure function `calculateGlobalScore(subScores: Map<HealthScanType, number>): number | null` — returns null when no modules have scores.

---

### R2: Score Color Thresholds — Reuse Quality Score System

**Decision**: Reuse existing `getScoreThreshold()` and `getScoreColor()` from `lib/quality-score.ts`.

**Rationale**: Spec auto-resolved decision confirms reuse. Existing thresholds: Excellent (90-100, ctp-green), Good (70-89, ctp-blue), Fair (50-69, ctp-yellow), Poor (0-49, ctp-red). Already WCAG AA compliant on dark background.

**Alternatives considered**:
- Custom thresholds per module → Rejected per spec auto-resolved decision (revisitable later)
- New threshold utility → Unnecessary duplication

---

### R3: Polling Pattern for Scan Status

**Decision**: 15s polling interval using TanStack Query `refetchInterval`, consistent with analytics/notifications.

**Rationale**: Existing app uses 15s for analytics and notifications. Scan status doesn't require faster updates — scans run as GitHub workflows taking minutes. 15s is a good balance between responsiveness and server load.

**Implementation**: `useHealthPolling` hook wrapping `useQuery` with `refetchInterval: 15_000` and `refetchIntervalInBackground: false`. Stops polling when no scans are PENDING/RUNNING.

**Alternatives considered**:
- 2s polling (like jobs) → Overkill for workflow-based scans that take minutes
- Server-Sent Events → Not in tech stack, adds infrastructure complexity
- WebSockets → Explicitly rejected in spec

---

### R4: Workflow Dispatch for Health Scans

**Decision**: Dispatch `health-scan.yml` GitHub workflow using existing Octokit pattern from `lib/workflows/dispatch-ai-board.ts`.

**Rationale**: Spec explicitly defines this approach. Existing dispatch pattern provides: test mode support, error handling, input validation. The workflow file itself is out of scope — only the dispatch mechanism.

**Implementation**: New `dispatch-health-scan.ts` in `lib/workflows/` following `dispatch-ai-board.ts` pattern. Inputs: `project_id`, `scan_type`, `scan_id`, `base_commit`, `head_commit`, `githubRepository`.

**Alternatives considered**:
- In-process scanning → Rejected (spec mandates workflow dispatch)
- Reuse ai-board-assist.yml with scan command → Separate workflow is cleaner for independent scan lifecycle

---

### R5: Concurrent Scan Prevention

**Decision**: Application-level check via Prisma query before creating scan record. Check for existing PENDING/RUNNING scan of the same type for the same project.

**Rationale**: Simple and effective. Race conditions are mitigated by the short time window between check and insert. A database unique partial index could add stronger guarantees but adds migration complexity for minimal benefit.

**Implementation**: Before creating a HealthScan, query: `WHERE projectId = X AND scanType = Y AND status IN (PENDING, RUNNING)`. Return 409 Conflict if found.

**Alternatives considered**:
- Database partial unique index on (projectId, scanType) WHERE status IN (PENDING, RUNNING) → PostgreSQL supports this but Prisma doesn't natively model partial indexes; would need raw SQL in migration
- Optimistic insert with catch on constraint violation → More complex error handling

---

### R6: Incremental Scan — Base/Head Commit Tracking

**Decision**: Store `baseCommit` and `headCommit` on each HealthScan record. First scan has null baseCommit. Subsequent scans derive baseCommit from the last COMPLETED scan's headCommit.

**Rationale**: Spec FR-016 defines this exactly. The workflow uses these commits to determine the diff range for analysis.

**Implementation**: On scan creation, query last COMPLETED scan of same type for project, extract headCommit as new scan's baseCommit. If no completed scan exists, baseCommit = null (full scan).

---

### R7: HealthScore Cache — One Per Project

**Decision**: Single HealthScore record per project (unique constraint on projectId), updated after each completed scan via upsert.

**Rationale**: Avoids recomputing global score on every page load. Sub-scores stored as JSON object keyed by scan type. Updated atomically after scan completion.

**Implementation**: After scan completes with a score, upsert HealthScore: update the specific module sub-score, recompute global score, update timestamps. Use Prisma `upsert` with `where: { projectId }`.

---

### R8: Passive Modules — Quality Gate & Last Clean

**Decision**: Quality Gate derives score from average of completed verify job qualityScores. Last Clean derives from the most recent CLEAN workflow job.

**Rationale**: Spec defines these as passive (no scan button, no HealthScan records). Data comes from existing Job model.

**Implementation**:
- Quality Gate: `SELECT AVG(qualityScore) FROM Job WHERE projectId = X AND qualityScore IS NOT NULL`
- Last Clean: `SELECT * FROM Job WHERE projectId = X AND command = 'clean' AND status = 'COMPLETED' ORDER BY completedAt DESC LIMIT 1`
- These are computed on HealthScore upsert or on page load (cached in HealthScore).

---

### R9: Module Card Visual States

**Decision**: 4 states per FR-010: never-scanned, scanning, completed, failed. State derived from latest HealthScan record for active modules, or from computed data for passive modules.

**Rationale**: Clear state machine with distinct visual treatments. Uses existing shadcn/ui Card, Badge, Button, and Loader2 (spinner) components.

**Implementation**: `ModuleCard` component receives module config + latest scan data, renders appropriate state. Uses `cn()` utility for conditional classes with Aurora theme tokens.

---

### R10: Sidebar Navigation — HeartPulse Icon Placement

**Decision**: Add `{ id: 'health', label: 'Health', icon: HeartPulse, href: '/health', group: 'views' }` to `nav-items.ts` after the Comparisons entry.

**Rationale**: Spec FR-001 defines exact placement. HeartPulse is available in lucide-react. Follows existing nav item pattern exactly.

**Implementation**: Single line addition to the `navItems` array in `components/navigation/nav-items.ts`.
