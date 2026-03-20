# Research: Ticket Comparison Dashboard (AIB-324)

**Date**: 2026-03-20
**Status**: Complete

## Research Tasks & Findings

### 1. Data Storage Approach — Dedicated Prisma Models vs. JSON on Job

**Decision**: Dedicated Prisma models (`Comparison`, `ComparisonEntry`, `ComparisonDecisionPoint`)

**Rationale**:
- Spec explicitly requires bidirectional ticket-to-comparison lookups (FR-002), which demands a join table
- Structured querying (e.g., "all comparisons for ticket X") is far more efficient with dedicated models than JSON scanning
- Follows the project's existing pattern: quality scores are stored as typed fields on Job, not in a generic JSON blob
- Prisma relations enable type-safe queries with `include` and `select`

**Alternatives Considered**:
- **JSON field on Job**: Rejected — no way to do bidirectional lookups efficiently; violates database normalization
- **Extending existing Ticket model with JSON**: Rejected — pollutes Ticket model with comparison-specific data; makes multi-comparison per ticket awkward

---

### 2. API Pattern — How Quality Scores Are Saved (Reference Pattern)

**Decision**: Follow the Job status PATCH pattern for workflow-initiated saves, plus a dedicated POST endpoint for comparison creation

**Rationale**:
- Quality scores are saved via `PATCH /api/jobs/:id/status` when job status transitions to COMPLETED (lines 176-200 of `app/api/jobs/[id]/status/route.ts`)
- For comparisons, the `/compare` command runs outside a single job context — it compares multiple tickets
- A dedicated `POST /api/projects/:projectId/comparisons` endpoint is more appropriate
- Auth via Bearer workflow token (same as job status updates)

**Alternatives Considered**:
- **Piggyback on job status endpoint**: Rejected — comparisons aren't tied to a single job; they span multiple tickets
- **File-only storage with parsing**: Rejected — spec requires structured DB storage (FR-001)

---

### 3. UI Access Pattern — Tab vs. Standalone Page

**Decision**: Conditional "Comparisons" tab on ticket detail modal (5th tab when comparisons exist)

**Rationale**:
- Follows existing pattern: Stats tab is conditionally shown when `hasJobs` is true (ticket-detail-modal.tsx lines 969-998)
- Grid layout already supports dynamic column count (`grid-cols-3` / `grid-cols-4`)
- Extending to `grid-cols-5` when both Stats and Comparisons are available is straightforward
- No need for a standalone page — comparisons are ticket-contextual

**Alternatives Considered**:
- **Standalone comparison page**: Rejected — adds routing complexity; comparison is best understood in ticket context
- **Inline section on Details tab**: Rejected — too cluttered; tab separation provides cleaner UX

---

### 4. Existing Comparison Infrastructure

**Decision**: Extend existing hooks and components rather than replacing them

**Rationale**:
- `hooks/use-comparisons.ts` already has `useComparisonCheck`, `useComparisonList`, `useComparisonReport` with query key structure
- `components/comparison/comparison-viewer.tsx` handles markdown report display
- `lib/types/comparison.ts` has comprehensive type definitions (336 lines)
- New DB-backed features should add new hooks (e.g., `useComparisonDashboard`) alongside existing file-based hooks
- File-based comparison list can coexist with DB-backed data (backward compatibility per FR-007)

**Alternatives Considered**:
- **Replace all file-based code**: Rejected — spec requires backward compatibility (FR-007); markdown files must continue to be generated

---

### 5. Recharts Visualization Patterns

**Decision**: Use Recharts `BarChart` (horizontal layout) for metrics comparison, custom Card grid for ranking and compliance

**Rationale**:
- Existing analytics use horizontal `BarChart` for dimension comparisons (analytics components)
- Metrics comparison (lines added/removed, files, test ratio) maps naturally to grouped horizontal bars
- Ranking section is better as Cards with visual hierarchy (winner highlighted) than a chart
- Constitution compliance grid is a table/grid pattern, not a chart
- `ResponsiveContainer` + semantic color tokens (`hsl(var(--chart-*))`) are established patterns

**Alternatives Considered**:
- **RadarChart for compliance**: Rejected — compliance is pass/fail per principle, not a continuous scale
- **Table-only for metrics**: Rejected — spec requires "visual indicators" (FR-005)

---

### 6. Handling Missing Data (Graceful Degradation)

**Decision**: API returns null for missing fields; UI renders "Pending" for quality scores, "N/A" for telemetry

**Rationale**:
- Quality scores populate asynchronously (only after verify job completes) — "Pending" indicates eventual availability
- Telemetry may never exist for some tickets (e.g., no jobs run) — "N/A" indicates permanent absence
- Existing Stats tab uses similar patterns (shows "N/A" when no telemetry data)
- No additional polling needed — data appears on next page load once available (per spec auto-resolved decision)

**Alternatives Considered**:
- **Skeleton loaders for missing data**: Rejected — would imply data is loading when it may not exist yet
- **Hide sections with missing data**: Rejected — spec requires all sections always visible with placeholder states

---

### 7. Bidirectional Ticket Linking

**Decision**: `ComparisonEntry` join table links each ticket to its comparison; lookups query `ComparisonEntry` where `ticketId = X`

**Rationale**:
- A comparison links to N tickets via N `ComparisonEntry` rows
- Finding "all comparisons for ticket X" = `SELECT * FROM ComparisonEntry WHERE ticketId = X`
- No need for a separate "link" table — `ComparisonEntry` already serves as the join table since it holds per-ticket data
- Source ticket is tracked on the `Comparison` model itself for provenance

**Alternatives Considered**:
- **Separate ComparisonTicketLink table**: Rejected — redundant; ComparisonEntry already establishes the relationship
- **Array field on Comparison**: Rejected — no referential integrity; can't do reverse lookups efficiently

---

### 8. Access Control

**Decision**: Reuse existing `verifyProjectAccess(projectId)` helper for all comparison endpoints

**Rationale**:
- Comparisons are scoped to projects (tickets belong to projects)
- `verifyProjectAccess` already checks owner OR member access (lib/auth.ts)
- All existing comparison endpoints already use this pattern
- No need for comparison-level permissions — project access implies comparison access

**Alternatives Considered**:
- **Per-comparison ACL**: Rejected — over-engineering; project-level access is sufficient per spec (FR-009)
