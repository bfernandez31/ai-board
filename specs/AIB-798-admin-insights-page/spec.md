# Feature Specification: Admin Insights page cosmetic refresh and failed report diagnostics

**Feature Branch**: `AIB-798-admin-insights-page`
**Created**: 2026-05-14
**Status**: Draft
**Input**: Ticket AIB-798 — "Admin Insights page cosmetic refresh and failed report diagnostics"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: The "Reessayer" (Retry) button on a FAILED report reuses the existing `POST /api/admin/insights/trigger` endpoint rather than introducing a new "retry-by-id" endpoint. A FAILED run does not advance the high-water mark, so the next trigger naturally re-covers the unanalyzed window starting from the previous COMPLETED `periodEnd` (or earliest Claude session for the first-ever run).
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: High (score -3, internal admin tooling + no new contracts needed)
- **Fallback Triggered?**: No — period semantics (functional spec §"Period Semantics") guarantee window equivalence in the common case.
- **Trade-offs**:
  1. If a newer COMPLETED report has advanced the high-water mark between the FAILED row and the retry click, the retry covers the *current* unanalyzed window instead of the exact FAILED window. The metadata header always reflects the actual covered window, so the operator is never misled.
  2. Avoids adding a `retry-by-id` API surface that would duplicate the trigger's preflight, single-flight, and dispatch logic.
- **Reviewer Notes**: Confirm that the retry button uses the same mutation as "Run new analysis" and that refusal codes (`ALREADY_RUNNING`, `NO_NEW_SHIPPED`) surface identically.

- **Decision**: The GitHub Actions run link on a FAILED report points to the AI-BOARD centralized repository's Actions tab — URL pattern `https://github.com/{AI_BOARD_OWNER}/{AI_BOARD_REPO}/actions/runs/{workflowRunId}` — derived from the failed run's underlying `Job.workflowRunId`. When `workflowRunId` is null (dispatch never landed, or row was auto-FAILED by reconciliation before dispatch), the panel shows the failure reason without a link and explains briefly that no workflow run is associated.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score +4, operator diagnostics + integrity of the audit trail)
- **Fallback Triggered?**: Yes — when `workflowRunId` is missing, the panel falls back to "no run link available" instead of fabricating a guess.
- **Trade-offs**:
  1. The link assumes insights workflows always run on the AI-BOARD repository (current centralized-workflow architecture); if that ever changes, the URL builder becomes a one-line config change.
  2. Showing the panel without a link in the null case is slightly less helpful, but it never sends operators to a non-existent or wrong run page.
- **Reviewer Notes**: Confirm the URL builder reads the AI-BOARD owner/repo from existing centralized-workflow config (env var or constant already used by dispatch code), not from per-project `githubRepository`. Manually verify the resulting URL opens the correct run in a fresh tab.

- **Decision**: The "currently selected" past report is marked with both a subtle background tint and a left-edge lateral indicator, mirroring the active-state convention chosen for the admin sidebar in AIB-796. Selection state lives in client memory only; reloading the page resets selection to the latest COMPLETED report (or latest row if none is COMPLETED), preserving the current server-rendered default.
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Medium (score +2, consistency with sibling shell)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Operators cannot bookmark a specific report's view via URL. Acceptable for V1 — reports are addressed by ID server-side and the list is short.
  2. Reusing the shell's active-state pattern reduces visual noise and avoids a second "selection style" in the admin space.
- **Reviewer Notes**: If URL-addressable selection is later desired (e.g., `/admin/insights?report=42`), it can be layered on top without changing the layout.

- **Decision**: Compact period display in the past-reports table uses the form `M/D → M/D` for periods within a single calendar year and `M/D/YY → M/D/YY` when the period crosses year boundaries. Single-day periods collapse to `M/D`. The full ISO form (`YYYY-MM-DD`) remains in the metadata header on the right-side panel.
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Medium (score -2, density requirement)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Operators lose year context inside-year, but the generation-date column always carries the full year, so the row is never ambiguous in practice.
  2. Aggressive compactness keeps each row inside the ~30-36px target without truncation.
- **Reviewer Notes**: If operators consistently scan reports across long retention windows, the format can be widened in a follow-up without changing the data shape.

- **Decision**: Row "Duration" for COMPLETED rows is computed as `completedAt - createdAt` (wall-clock elapsed between report creation and terminal status), shown as compact `Nm` or `Hh Mm`. For non-COMPLETED rows (RUNNING, FAILED), the duration cell is left blank rather than showing a partial elapsed value — those rows already convey status via the badge, and partial durations would be misleading.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score +2, honest reporting)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. RUNNING rows lose "currently elapsed" feedback, but the RUNNING badge plus the 15s poll already convey progress.
  2. Avoids any chance of presenting a FAILED row's partial duration as if it were a successful runtime.
- **Reviewer Notes**: Validate that duration formatting is locale-stable and never shows "0s" for sub-second completions (rare in practice; if it occurs, "<1s" is acceptable).

- **Decision**: On narrow viewports (below the existing tablet breakpoint), the side-by-side layout collapses to stacked panels — past-reports table above, selected report below — rather than hiding the list behind a drawer. The reports table retains its dense row style and gains a max height with internal scrolling to bound vertical real estate.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Low (score +1, narrow viewport polish for an admin-only page)
- **Fallback Triggered?**: Yes — without explicit guidance and given the page is operator-only, the safest call is a predictable stack that never strands content off-screen.
- **Trade-offs**:
  1. Slightly more vertical scrolling on narrow viewports, but no element disappears unexpectedly.
  2. Avoids adding a drawer/toggle control that would only matter for an operator-only page rarely viewed on small devices.
- **Reviewer Notes**: Operators reach this page primarily from desktop; the stacked behavior is a graceful degradation, not the primary UX target.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin reads the latest report inside the admin shell with no visual duplication (Priority: P1)

An allowlisted operator navigates to `/admin/insights` from the admin sidebar. The page renders inside the existing admin shell (global header + admin sidebar). The "Insights LLM" sidebar item is active. The main content area shows a clear two-column layout: a compact past-reports list on the left and the selected report's content on the right. The page no longer carries an internal "Claude Code Insights" heading — the sidebar item already names the page.

**Why this priority**: This is the headline UX issue the ticket exists to fix. Until the layout integrates cleanly into the shell and drops the duplicate title, the admin space feels visually inconsistent and wastes vertical room on redundant text.

**Independent Test**: As an admin, click "Insights LLM" in the admin sidebar. Confirm the URL is `/admin/insights`, the global header is present, the admin sidebar is present with "Insights LLM" active, there is no internal `<h1>Claude Code Insights</h1>`, and the browser tab title is "Insights LLM".

**Acceptance Scenarios**:

1. **Given** an admin on any non-admin page, **When** they click "Insights LLM" in the admin sidebar (or navigate to `/admin/insights` directly), **Then** the page renders inside the admin shell with the global header, the admin sidebar, and a content area showing the two-column insights layout.
2. **Given** the insights page is rendered, **When** the operator inspects the visible content, **Then** there is no page-internal H1 reading "Claude Code Insights" (the sidebar's "Insights LLM" entry is the only on-screen naming for the page).
3. **Given** the insights page is rendered, **When** the operator inspects the browser tab, **Then** the document title is "Insights LLM" (not "Claude Code Insights").
4. **Given** the insights page is rendered, **When** the operator looks at the admin sidebar, **Then** the "Insights LLM" entry has the active visual state defined by AIB-796 (background tint + lateral indicator).

---

### User Story 2 — Admin scans past reports in a compact side panel and switches between them in place (Priority: P1)

An admin viewing `/admin/insights` sees the past-reports list rendered as a dense table in a left-side internal panel approximately 280px wide. Each row fits between 30 and 36 pixels in height and surfaces the four facts the operator actually needs at a glance: generation date, period covered (compact form), run status (badge), and duration for COMPLETED runs. Clicking any row swaps the right-side content to that report without a full page reload, and the selected row is visually marked so the operator never loses their place.

**Why this priority**: This is the second headline UX issue. The current single-column 80-pixel blocks make scanning history awkward and put the list and the report content in competition for vertical space.

**Independent Test**: As an admin with at least 5 reports in mixed statuses, render `/admin/insights`. Confirm: (a) the past-reports panel is roughly 280px wide and contains a dense table; (b) each row is between 30 and 36 pixels tall; (c) every row shows the four columns above; (d) the currently displayed report's row is visually marked; (e) clicking another row updates the right-side content immediately without a full page reload; (f) the newly selected row becomes the marked row.

**Acceptance Scenarios**:

1. **Given** the insights page with several past reports, **When** the page renders, **Then** the past-reports panel occupies an internal column of approximately 280 pixels on the left and lists the reports as a dense table with rows between 30 and 36 pixels tall.
2. **Given** a past-reports table, **When** the operator looks at any row, **Then** they see: a generation date (full year), a compact period (e.g., `5/1 → 5/8`), a status badge, and a duration cell that shows a compact elapsed time for COMPLETED rows and is blank for RUNNING/FAILED rows.
3. **Given** the operator is viewing report A on the right, **When** they click the row for report B, **Then** the right-side content updates to report B (HTML body for COMPLETED, error panel for FAILED, running placeholder for RUNNING) and the visual selection moves from row A to row B — both within a single render, no full page reload.
4. **Given** the operator has clicked through reports, **When** they refresh the page, **Then** the right side resets to the default selection (latest COMPLETED, or latest row if no COMPLETED exists) — selection is not persisted across reloads.
5. **Given** the past-reports list is empty, **When** the page renders, **Then** the left panel shows a compact "no prior runs" empty state and the right panel shows the existing global empty state (with the trigger button still visible if pre-flight allows).

---

### User Story 3 — Admin diagnoses a FAILED report with a direct link to the workflow run and a one-click retry (Priority: P1)

An admin clicks a FAILED row in the past-reports table. The right-side panel renders an inline failure diagnostics view containing: the report's failure reason in readable form, a clickable link that opens the corresponding GitHub Actions workflow run in a new tab (so the operator can read the underlying logs), and a "Reessayer" button that triggers a new analysis covering the unanalyzed window. The "Run new analysis" button in the top-right of the right panel remains available and continues to honor its existing preflight gating identically.

**Why this priority**: The current FAILED experience shows only `"Workflow step failed; see workflow logs"` with no link, forcing the operator to manually navigate to GitHub Actions and grep for the right run. This is the most acute pain in the failure path and the diagnostic feature that unblocks operators.

**Independent Test**: Seed a FAILED `InsightsReport` row with a non-null `Job.workflowRunId`. As an admin, open `/admin/insights` and click that row. Confirm: (a) the right panel shows the failure reason inline with legible formatting; (b) the panel contains a link whose href matches the AI-BOARD repository's GitHub Actions run URL for that `workflowRunId`, opens in a new tab, and is visually distinguishable as a link; (c) the panel contains a "Reessayer" button; (d) clicking "Reessayer" dispatches a new analysis (or shows the same refusal codes the trigger endpoint would otherwise return); (e) the top-right "Run new analysis" button still works identically.

**Acceptance Scenarios**:

1. **Given** a FAILED report selected in the right panel, **When** the panel renders, **Then** the failure reason from the report row is displayed inline, with line breaks preserved (multi-line reasons are readable, not crushed into a single paragraph).
2. **Given** a FAILED report with a non-null `workflowRunId`, **When** the panel renders, **Then** it contains a link whose target is the AI-BOARD repository's GitHub Actions run page for that workflow run ID, opens in a new tab (`target="_blank"` with appropriate `rel`), and is labeled so the operator understands it leads to the workflow logs.
3. **Given** a FAILED report whose `workflowRunId` is null (workflow dispatch failed, or row was auto-failed by reconciliation), **When** the panel renders, **Then** the failure reason still displays inline, the GitHub Actions link is omitted, and a short explanation indicates that no workflow run is associated with this row.
4. **Given** a FAILED report panel, **When** the operator clicks "Reessayer", **Then** the same trigger flow as the top-right "Run new analysis" button is invoked (same endpoint, same preflight, same single-flight gating, same optimistic UI update).
5. **Given** "Reessayer" is clicked while the preflight already refuses (e.g., a RUNNING row exists), **Then** the operator sees the refusal message identical to what the "Run new analysis" button would surface in the same state.
6. **Given** the FAILED report's window has already been re-covered by a later COMPLETED report, **When** the operator clicks "Reessayer", **Then** the trigger still proceeds (if shipped-tickets preflight passes) but the new run covers the *current* unanalyzed window — the metadata header on the new row honestly reflects that window.

---

### User Story 4 — Admin keeps unchanged access to the "Run new analysis" action (Priority: P2)

The existing "Run new analysis" button continues to live in the top-right of the right-side content area. All of its current behavior — preflight check, eligibility conditions, refusal messages with their refusal codes, optimistic UI update, single-flight gating — is preserved unchanged. The cosmetic refresh does not move the button into the sidebar or otherwise hide it.

**Why this priority**: This isn't a *new* capability — it's a regression guard. The ticket explicitly requires that "Sa logique actuelle (préflight check, conditions d'éligibilité, refus motivé) est conservée à l'identique."

**Independent Test**: Run the full existing trigger-button integration test matrix (canTrigger=true, ALREADY_RUNNING, NO_NEW_SHIPPED, dispatch failure) and confirm every outcome matches the pre-refresh behavior bit-for-bit (refusal codes, messages, optimistic RUNNING row insertion, polling resumption).

**Acceptance Scenarios**:

1. **Given** the refreshed insights page, **When** the operator looks at the top-right of the right-side content area, **Then** they see the "Run new analysis" button in a position visually equivalent to its prior placement (top-right of the main content area).
2. **Given** the preflight returns `canTrigger=true`, **When** the operator clicks "Run new analysis", **Then** the trigger flow is identical to the pre-refresh behavior (POST to `/api/admin/insights/trigger`, optimistic RUNNING row insertion, 15s polling pickup).
3. **Given** any preflight refusal condition (`ALREADY_RUNNING`, `NO_NEW_SHIPPED`), **When** the operator hovers / reads the button area, **Then** the refusal code and message are identical to those currently surfaced.
4. **Given** the operator triggers a run from either the top-right button or the "Reessayer" button on a FAILED row, **Then** both code paths leave the system in the same observable state (one new RUNNING row, polling active, button disabled until the run reaches a terminal status).

---

### Edge Cases

- The past-reports list is at its server-side cap of 200 entries. The left panel's table scrolls internally within its bounded height, the right-side content area is unaffected.
- A FAILED row's `errorReason` is at the schema cap (500 characters) and contains line breaks. The right panel renders the full text wrapped and scrollable if needed — never truncated mid-message.
- A FAILED row's `errorReason` is empty/null (rare, but possible for legacy rows). The right panel shows a stable fallback message (e.g., "Run failed without a recorded reason — open the workflow run for details") and still shows the GitHub Actions link when `workflowRunId` is set.
- The operator clicks "Reessayer" twice in rapid succession. The mutation's pending state and the optimistic RUNNING insertion prevent a double dispatch; the second click is a no-op while the first is in flight.
- A RUNNING row is currently selected on the right panel. The placeholder still says "Run in progress" and the polling resolves the row to a terminal status on its next tick — the panel updates in place without operator intervention.
- The operator opens the GitHub Actions link but is not signed into GitHub (or lacks access to the AI-BOARD repository). That is a GitHub-side concern; the application's link itself is correct.
- The viewport is narrow (mobile/tablet). Panels stack vertically as described in the auto-resolved decision; the table retains its dense row style and bounds its height with internal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The page at `/admin/insights` MUST render inside the admin shell introduced by AIB-796 (global header + admin sidebar + main content area), with the "Insights LLM" sidebar entry active.
- **FR-002**: The page MUST NOT render any internal page-level heading naming "Claude Code Insights" or any equivalent title; the admin sidebar's "Insights LLM" entry is the sole on-screen page identifier.
- **FR-003**: The browser tab title (document title) for `/admin/insights` MUST be "Insights LLM".
- **FR-004**: The right-side metadata sub-header that summarizes a single report (sessions count, tickets count, period) remains permitted and MUST NOT be confused with a page-level heading.
- **FR-005**: The main content area MUST present a two-column internal layout: a left panel for the past-reports list and a right panel for the selected report's content (metadata header, body, and contextual actions).
- **FR-006**: The left panel MUST be approximately 280 pixels wide on desktop viewports. The right panel MUST occupy the remaining horizontal space inside the admin shell's content area.
- **FR-007**: The past-reports list MUST be rendered as a dense table with row height between 30 and 36 pixels (excluding optional internal padding for hover/focus indicators).
- **FR-008**: Each past-reports row MUST display four columns in this order: generation date (full year), compact period covered, run status badge, and a duration cell. The duration cell MUST be populated for COMPLETED rows (compact elapsed between `createdAt` and `completedAt`) and MUST be blank for RUNNING and FAILED rows.
- **FR-009**: The currently selected past-reports row MUST be visually marked with both a subtle background tint and a left-edge lateral indicator, consistent with the active-state convention used by the AIB-796 admin sidebar.
- **FR-010**: Clicking a past-reports row MUST update the right panel's content (HTML iframe for COMPLETED, failure diagnostics panel for FAILED, running placeholder for RUNNING) and the selection indicator without a full page reload.
- **FR-011**: When the right panel renders a FAILED report, it MUST display the row's `errorReason` inline with whitespace and line breaks preserved (multi-line reasons remain readable).
- **FR-012**: When the right panel renders a FAILED report whose underlying `Job.workflowRunId` is not null, the panel MUST contain a labeled link whose href points to the AI-BOARD repository's GitHub Actions run page for that workflow run ID, opens in a new browser tab, and uses appropriate `rel` attributes for cross-origin safety.
- **FR-013**: When the right panel renders a FAILED report whose underlying `Job.workflowRunId` is null, the panel MUST omit the GitHub Actions link and display a short explanation indicating that no workflow run is associated with this row.
- **FR-014**: When the right panel renders a FAILED report, it MUST display a "Reessayer" button that, on click, invokes the same trigger flow as the existing "Run new analysis" button (same endpoint `POST /api/admin/insights/trigger`, same preflight, same single-flight gating, same optimistic UI behavior).
- **FR-015**: The "Run new analysis" button MUST remain visible in the top-right of the right panel and MUST preserve every behavior of its current implementation: preflight evaluation (`canTrigger`, refusal codes `ALREADY_RUNNING` / `NO_NEW_SHIPPED`), disabled state when the latest visible row is RUNNING, optimistic insertion of a RUNNING row, polling resumption, error/refusal display.
- **FR-016**: The 15-second polling for the reports list and the live preflight refresh MUST continue to operate unchanged across the refresh; row updates in the left panel and content updates in the right panel MUST reflect new server state without operator action.
- **FR-017**: All visual styling (panels, table, badges, selected-state indicator, FAILED diagnostics panel, "Reessayer" button, link styling) MUST use the project's existing design tokens (Tailwind semantic tokens, shadcn/ui conventions, Aurora-B+ utilities where applicable). No hardcoded hex/rgb colors.
- **FR-018**: The page MUST adapt to narrow viewports by stacking the two panels vertically (list above, selected report below). The table MUST retain its dense rows and bound its height with internal scrolling to avoid pushing the report content off-screen.
- **FR-019**: The page MUST continue to delegate authorization to `requireAdminPageOrNotFound` (inherited from the admin shell). The cosmetic refresh MUST NOT introduce any new client-side admin check, allowlist lookup, or DOM emission for non-admins.
- **FR-020**: The reconciliation pass (`reconcileOrphanedRunningReports`) that runs on every page load MUST be preserved — no regression to the current orphan-row handling.

### Key Entities *(include if feature involves data)*

- **PastReportRow** (display projection — not a new persisted entity): The row-level facts the dense table renders for each entry. Attributes derived from `InsightsReport` + joined `Job`: `id`, `status` (badge), `generatedAt` (formatted, full year), `periodStart`/`periodEnd` (compact period), `durationMs` (computed for COMPLETED only as `completedAt - createdAt`), `workflowRunId` (for the FAILED panel's link). No new schema fields.
- **FailureDiagnosticsView** (display state — not a new persisted entity): The right-panel composition for a FAILED row. Attributes: `errorReason` (rendered inline with whitespace preserved), `githubRunUrl` (computed from `Job.workflowRunId` + AI-BOARD repo config; null when `workflowRunId` is null), `retryDisabledReason` (reflects the same preflight refusal as the top-right button).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of `/admin/insights` renders for admins inside the admin shell — the global header, the admin sidebar (with "Insights LLM" active), and the two-column content area are all present. Verified by an integration test rendering the route as an admin fixture.
- **SC-002**: 0% of `/admin/insights` renders contain a page-internal `<h1>` (or equivalent top heading) reading "Claude Code Insights" or any synonym for the page name. Verified by content-grep over the rendered HTML.
- **SC-003**: 100% of `/admin/insights` document titles equal "Insights LLM". Verified by reading the `<title>` element in the rendered head.
- **SC-004**: The past-reports table renders rows whose computed height (in CSS pixels at the desktop breakpoint) falls within `[30, 36]` for at least 95% of rows in a test fixture with mixed statuses and longest-period labels. Verified by a layout snapshot or Playwright bounding-box check.
- **SC-005**: The past-reports panel's width on the desktop breakpoint falls within `[260, 300]` pixels for the column rule (target ~280). Verified by the same layout check.
- **SC-006**: Clicking any past-reports row updates the right panel and the selection indicator within 200 milliseconds of the click event, without any full page navigation (no `navigationStart` increment). Verified by a Playwright timing assertion.
- **SC-007**: For 100% of FAILED reports whose underlying `Job.workflowRunId` is non-null, the right-panel diagnostics view contains exactly one anchor element whose `href` matches the canonical AI-BOARD Actions run URL for that `workflowRunId`. Verified by a content assertion against seeded fixtures.
- **SC-008**: For 100% of FAILED reports whose underlying `Job.workflowRunId` is null, the right-panel diagnostics view contains zero anchor elements pointing to a GitHub Actions run, and contains the fallback explanatory text. Verified by a content assertion against seeded fixtures.
- **SC-009**: Clicking "Reessayer" on a FAILED row produces the same observable side effects as clicking "Run new analysis" in the same preflight state: same HTTP request to `/api/admin/insights/trigger`, same response handling, same optimistic UI update, same refusal surfacing. Verified by a behavior-equivalence integration test.
- **SC-010**: The existing trigger-button regression suite (preflight states, refusal codes, optimistic insertion, polling resumption) passes unchanged against the refreshed page. Verified by re-running the AIB-791 / functional-spec §"Triggering a New Analysis" test cases.
- **SC-011**: Toggling the application theme on `/admin/insights` updates every refreshed element (panels, table rows, badges, selection indicator, FAILED diagnostics panel, link) in lockstep with the rest of the app. Verified manually and by absence of any hardcoded color literals in the new components.
- **SC-012**: On a narrow viewport (below the existing tablet breakpoint), the two panels stack vertically without overlap, the table retains its dense row style, and the trigger button and FAILED diagnostics remain reachable without horizontal scrolling. Verified by a responsive snapshot test at a representative narrow width.
