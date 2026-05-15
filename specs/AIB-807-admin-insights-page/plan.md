# Implementation Plan: Admin Insights Page Cosmetic Refresh & Failed Report Diagnostics

**Branch**: `AIB-807-admin-insights-page`
**Date**: 2026-05-14
**Spec**: `specs/AIB-807-admin-insights-page/spec.md`

---

## Technical Context

| Aspect | Detail |
|--------|--------|
| **Core stack** | TypeScript 5.9 strict, Next.js 16 App Router, React 18, TailwindCSS 3.4, shadcn/ui |
| **Data layer** | Prisma 6.x → PostgreSQL 14+, TanStack Query v5 |
| **Existing feature** | Full insights pipeline: trigger → workflow → artifact upload → polling → iframe display |
| **Schema changes** | None required — all data exists, changes are API serialization + UI |
| **New dependencies** | None |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TS with explicit types |
| II. Component-Driven | PASS | Extends existing `insights-report-view.tsx` (single file, no premature extraction). New retry button reuses `RunAnalysisButton` with extended props. |
| III. Test-Driven | PASS | Extends 5 existing test files (unit + integration). No new test files needed — all domains already have coverage. |
| IV. Security-First | PASS | GitHub Actions URL resolved server-side (CONSERVATIVE). Retry period params validated via Zod. No raw env vars exposed to client. |
| V. Database Integrity | PASS | Retry creates new report+job via existing `createRunningReportAndJob()` transaction. No schema changes. |
| V. Spec Clarifications | PASS | All 5 auto-resolved decisions documented with CONSERVATIVE policy. |

---

## Implementation Phases

### Phase 1: API Layer — Extend `ReportListEntry` with Job data

**Goal**: Add `workflowRunId` and `githubActionsUrl` to the reports API response.

**Files to modify**:
1. `app/lib/insights/repository.ts` — Extend `toListEntry()` and `ReportListEntry` interface
2. `app/api/admin/insights/reports/route.ts` — Pass host project config to serializer
3. `app/api/admin/insights/reports/[id]/route.ts` — Same
4. `app/admin/insights/page.tsx` — Pass host config for SSR serialization

**Implementation details**:

1. **`repository.ts`**: Add `workflowRunId: string | null` and `githubActionsUrl: string | null` to `ReportListEntry`. Create a helper `buildGithubActionsUrl(workflowRunId: bigint | null | undefined, owner?: string, repo?: string): string | null` that constructs `https://github.com/{owner}/{repo}/actions/runs/{id}` or returns `null`. Update `toListEntry()` signature to accept the joined row type (with `job?: { workflowRunId: bigint | null }`) and the owner/repo strings.

2. **`listReports()`**: Add `include: { job: { select: { workflowRunId: true } } }` to the Prisma query. Similarly for `getReportById()`.

3. **Reports list route**: Read `GITHUB_OWNER`/`GITHUB_REPO` from env, pass to `toListEntry()`.

4. **SSR page**: Same env read, pass to `toListEntry()` calls.

**Pattern reference**: BigInt serialization — `workflowRunId` is `BigInt?` in Prisma; serialize as `String(val)` for JSON (see `tests/integration/tickets/timeline.test.ts:132` for BigInt handling pattern).

---

### Phase 2: API Layer — Retry via Trigger Endpoint

**Goal**: Accept optional `periodStart`/`periodEnd` in the trigger POST body to support retrying failed reports.

**Files to modify**:
1. `app/api/admin/insights/trigger/route.ts`

**Implementation details**:

1. Add Zod schema for the request body:
   ```ts
   const triggerBodySchema = z.object({
     periodStart: z.string().datetime().optional(),
     periodEnd: z.string().datetime().optional(),
   }).refine(
     (d) => (d.periodStart == null) === (d.periodEnd == null),
     { message: 'periodStart and periodEnd must both be present or both absent' }
   ).refine(
     (d) => !d.periodStart || !d.periodEnd || new Date(d.periodStart) < new Date(d.periodEnd),
     { message: 'periodStart must be before periodEnd' }
   );
   ```

2. Parse body via `request.json()` → validate with Zod. Return 400 on validation failure.

3. When explicit period params are provided:
   - Skip the `countShippedClaudeTicketsSince()` / NO_CLAUDE_JOBS / NO_NEW_SHIPPED gates (the original run proved eligibility)
   - Still enforce the ALREADY_RUNNING concurrency gate (unchanged)
   - Use the provided dates as `periodStart`/`periodEnd`

4. When no period params: existing behavior unchanged.

**Error handling**: Follow dispatch-then-rollback pattern from `trigger/route.ts:192-209` — this is already the same code path, just with different period source.

---

### Phase 3: UI — Side-by-Side Layout with Dense Report List

**Goal**: Restructure `InsightsReportView` from vertical to side-by-side layout with a compact left pane.

**Files to modify**:
1. `components/admin/insights/insights-report-view.tsx` — Major layout rewrite

**Implementation details**:

1. **Remove H1 title** (FR-003): Delete the `<h1>Claude Code Insights</h1>` — the admin shell already shows "Insights LLM" in the sidebar.

2. **Header area** (FR-018, FR-022): Keep the shipped-tickets counter and "Run new analysis" button in a header bar above the two-pane layout.

3. **Side-by-side wrapper**: Replace the outer `<div className="flex flex-col gap-6">` with:
   ```tsx
   <div className="flex flex-col gap-4">
     {/* header row */}
     <div className="flex flex-col gap-4 md:flex-row md:gap-6">
       {/* left pane */}
       <aside className="w-full md:w-[280px] md:shrink-0">...</aside>
       {/* right pane */}
       <main className="flex-1 min-w-0">...</main>
     </div>
   </div>
   ```

4. **Dense report list** (FR-006): Each row ~30-36px height. Compact layout:
   ```tsx
   <button className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ...">
     <span className="truncate">{formatDate(entry.generatedAt)}</span>
     <span className="text-muted-foreground truncate">
       {compactPeriod(entry.periodStart, entry.periodEnd)}
     </span>
     {duration && <span className="text-muted-foreground">{duration}</span>}
     <Badge variant={statusBadgeVariant(entry.status)} className="ml-auto text-[10px] px-1.5 py-0">
       {entry.status}
     </Badge>
   </button>
   ```

5. **Duration display** (FR-007): Compute client-side from `createdAt` → `completedAt`. Format as "Xm Ys" for short durations. Only show when both timestamps exist (COMPLETED reports).

6. **Active selection highlight** (FR-008): `bg-accent/50 border-l-2 border-primary` on the selected row (distinct from sidebar's `bg-accent/30`).

7. **Responsive stacking** (FR-005): The `md:flex-row` / `md:w-[280px]` pattern stacks vertically on small screens automatically.

8. **Right pane content**: Move the metadata card + `renderReportBody()` into the right pane. The existing iframe, error placeholder, and running placeholder all stay.

---

### Phase 4: UI — Failed Report Diagnostics

**Goal**: Add GitHub Actions link and retry button for FAILED reports.

**Files to modify**:
1. `components/admin/insights/insights-report-view.tsx` — Extend `renderReportBody()` for FAILED state
2. `components/admin/insights/run-analysis-button.tsx` — Accept optional retry period params

**Implementation details**:

1. **FAILED report right pane** (FR-011, FR-012, FR-014, FR-015): When a FAILED report is selected, the right pane shows:
   - Error reason text (existing `ReportErrorPlaceholder` with `detail={display.errorReason}`)
   - GitHub Actions link (if `display.githubActionsUrl` is non-null): `<a href={url} target="_blank" rel="noopener noreferrer">` with ExternalLink icon
   - Retry button

2. **GitHub Actions link** (FR-012, FR-013, FR-014): Conditionally rendered only when `githubActionsUrl` is present. Opens in new tab. Uses `ExternalLink` icon from lucide-react (already a project dependency).

3. **Retry button** (FR-015, FR-016, FR-017): Extend `RunAnalysisButton` to accept optional `retryPeriod?: { periodStart: string; periodEnd: string }` prop. When provided:
   - The mutation sends the period in the POST body
   - Button label changes to "Retry analysis" instead of "Run new analysis"
   - Same preflight gating applies (ALREADY_RUNNING blocks retry)
   - Same optimistic update pattern

4. **Retry flow**: The retry button is rendered inside the FAILED report's right pane, not in the header. It shares the same `preflight` data and `latestIsRunning` state.

---

### Phase 5: Tests

**Goal**: Extend existing test files to cover new behavior.

**Files to extend**:

1. **`tests/unit/components/admin/insights/insights-report-view.test.tsx`**:
   - Side-by-side layout renders (left pane + right pane visible)
   - H1 title is absent
   - FAILED report shows GitHub Actions link when `githubActionsUrl` is present
   - FAILED report hides link when `githubActionsUrl` is null
   - FAILED report shows retry button
   - Duration displayed for COMPLETED reports with `completedAt`

2. **`tests/unit/components/admin/insights/insights-report-view-list-selection.test.tsx`**:
   - Dense row format: generation date, period, status badge, duration visible
   - Active selection highlight class applied to selected row
   - Responsive: verify mobile layout stacks vertically (via container query or class check)

3. **`tests/unit/components/admin/insights/run-analysis-button.test.tsx`**:
   - Retry mode: button label says "Retry analysis"
   - Retry sends `periodStart`/`periodEnd` in POST body

4. **`tests/integration/api/admin/insights/trigger.test.ts`**:
   - Retry with valid period params creates new report
   - Retry with mismatched params (one missing) returns 400
   - Retry with `periodStart >= periodEnd` returns 400
   - Retry still blocked by ALREADY_RUNNING gate

5. **`tests/integration/api/admin/insights/reports-list.test.ts`**:
   - Response includes `workflowRunId` as string (when present)
   - Response includes `githubActionsUrl` (when env vars configured)
   - `workflowRunId` is `null` when Job has no run ID
   - `githubActionsUrl` is `null` when env vars missing

---

## Testing Strategy

Following constitution §III decision tree:

| What | Test Type | File (extend) |
|------|-----------|---------------|
| Side-by-side layout rendering | Vitest + RTL component test | `insights-report-view.test.tsx` |
| Dense row format & selection | Vitest + RTL component test | `insights-report-view-list-selection.test.tsx` |
| Retry button behavior | Vitest + RTL component test | `run-analysis-button.test.tsx` |
| Trigger retry API (period params) | Vitest integration test | `trigger.test.ts` |
| Reports list new fields | Vitest integration test | `reports-list.test.ts` |

No new test files needed. No E2E tests needed — this is a UI refresh of an existing admin page with API changes testable at the integration level.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `workflowRunId` not populated for insights jobs | Medium | GH Actions link missing (graceful null) | FR-014 explicitly handles null — link just doesn't appear |
| Retry bypasses NO_NEW_SHIPPED gate | Low | Intentional — spec decision D-1 | Still gated by ALREADY_RUNNING; retry reuses original proven window |
| BigInt serialization breaks JSON | Low | API 500 | `String()` conversion in `toListEntry()` — well-established pattern in codebase |
| Dense rows too compact on mobile | Low | Readability | Vertical stacking on mobile gives full-width rows; `text-xs` is standard for admin dense lists |

---

## Dependency Order

```
Phase 1 (API: ReportListEntry extension)
    │
    ├── Phase 2 (API: Retry trigger) — independent of Phase 1
    │
    ▼
Phase 3 (UI: Side-by-side layout) — needs Phase 1 for workflowRunId/githubActionsUrl fields
    │
    ▼
Phase 4 (UI: Failed diagnostics) — needs Phase 1 + 2 + 3
    │
    ▼
Phase 5 (Tests) — needs all phases complete
```

Phases 1 and 2 can be implemented in parallel. Phase 3 depends on Phase 1 (needs the new fields in `ReportListEntry`). Phase 4 depends on all prior phases. Phase 5 is last.
