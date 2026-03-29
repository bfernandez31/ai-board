# Feature Specification: Health Dashboard - Passive Modules Quality Gate & Last Clean

**Feature Branch**: `AIB-374-health-dashboard-modules`
**Created**: 2026-03-29
**Status**: Draft
**Input**: User description: "Health Dashboard - Modules passifs Quality Gate et Last Clean"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Quality Gate staleness threshold — when does the quality score become "stale"?
- **Policy Applied**: PRAGMATIC (via AUTO recommendation)
- **Confidence**: Medium (score 3 — internal dashboard feature with no security/compliance signals)
- **Fallback Triggered?**: No — AUTO recommended PRAGMATIC with sufficient confidence (0.6)
- **Trade-offs**:
  1. No staleness indicator needed for Quality Gate since it recalculates on every page load from the last 30 days of SHIP tickets
  2. Simpler UX with no additional warning states
- **Reviewer Notes**: If the team later wants a staleness alert (e.g., "no SHIP tickets in 30 days"), it can be added as a follow-up enhancement

---

- **Decision**: Last Clean "recent" vs "stale" threshold for visual alert
- **Policy Applied**: PRAGMATIC (via AUTO recommendation)
- **Confidence**: Medium — reasonable industry default exists
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Defaulting to 30 days as the staleness threshold (matches the Quality Gate analysis window) keeps the UX consistent
  2. A shorter threshold (e.g., 14 days) would create more frequent alerts but may be noisy for projects with infrequent changes
- **Reviewer Notes**: The 30-day threshold should be validated against actual project cleanup frequency. Consider making this configurable in a future iteration if teams have different cadences

---

- **Decision**: Quality Gate trend display when previous period has zero SHIP tickets
- **Policy Applied**: PRAGMATIC
- **Confidence**: Medium — standard analytics pattern
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. When the previous 30-day period has no SHIP tickets, the trend is displayed as "N/A" or "New" rather than showing a misleading percentage change
  2. Avoids division-by-zero edge cases and confusing UX
- **Reviewer Notes**: Ensure the UI clearly communicates why no trend is available (e.g., "Not enough history")

---

- **Decision**: Last Clean drawer history depth
- **Policy Applied**: PRAGMATIC
- **Confidence**: Medium — bounded by practical relevance
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Show up to 10 most recent cleanup jobs in the drawer history (consistent with scan history patterns)
  2. More than 10 entries adds scrolling complexity with diminishing informational value
- **Reviewer Notes**: Can increase if users request deeper history

---

- **Decision**: Quality Gate score thresholds for repartition labels
- **Policy Applied**: PRAGMATIC
- **Confidence**: High — reuse existing threshold system from score-calculator
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Reuses the existing threshold labels (Excellent: 90-100, Good: 70-89, Fair: 50-69, Poor: 0-49)
  2. Consistent with the rest of the Health Dashboard
- **Reviewer Notes**: None — straightforward reuse of existing conventions

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quality Gate Card Overview (Priority: P1)

A project owner navigates to the Health Dashboard and sees the Quality Gate card displaying the average quality score of all tickets that reached SHIP stage in the last 30 days. The card shows the score, the number of qualifying tickets, a trend indicator comparing to the previous period, and a breakdown of how many tickets fall into each threshold category (Excellent/Good/Fair/Poor).

**Why this priority**: The Quality Gate score contributes 20% to the global Health Score. Displaying it correctly is the core deliverable and the foundation all other Quality Gate features build upon.

**Independent Test**: Can be fully tested by creating a project with SHIP-stage tickets that have quality scores, loading the Health Dashboard, and verifying the card shows the correct average score, ticket count, trend, and threshold distribution.

**Acceptance Scenarios**:

1. **Given** a project has 5 tickets at SHIP stage with completed verify jobs (scores: 95, 82, 74, 61, 45) in the last 30 days, **When** the user opens the Health Dashboard, **Then** the Quality Gate card displays an average score of 71, ticket count of 5, and the distribution: 1 Excellent, 1 Good, 1 Fair, 1 Poor (with one ticket at 82 as Good).
2. **Given** a project has no tickets at SHIP stage in the last 30 days, **When** the user opens the Health Dashboard, **Then** the Quality Gate card displays "---" with summary "No qualifying tickets" and no trend indicator.
3. **Given** a project had an average score of 60 in the previous 30-day period and 75 in the current period, **When** the user opens the Health Dashboard, **Then** the Quality Gate card shows an upward trend indicator with the improvement value.
4. **Given** a project has qualifying tickets only in the current 30-day period (none in the previous period), **When** the user opens the Health Dashboard, **Then** the trend indicator shows "N/A" or "New" instead of a percentage change.

---

### User Story 2 - Quality Gate Drawer Detail (Priority: P2)

A project owner clicks on the Quality Gate card to open the detail drawer. The drawer shows the breakdown by quality dimension (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync) with average scores, a list of recent SHIP tickets with individual scores, and a trend graph over time.

**Why this priority**: The drawer provides the detailed analysis that helps project owners understand where quality improvements are needed. It builds on the card data from P1.

**Independent Test**: Can be fully tested by opening the Quality Gate drawer and verifying dimension breakdown scores match the average of individual ticket dimension scores, the ticket list is correct, and the trend graph renders data points.

**Acceptance Scenarios**:

1. **Given** a project has 3 SHIP tickets with quality score details including dimension breakdowns, **When** the user opens the Quality Gate drawer, **Then** the drawer displays the average score for each of the 5 dimensions across all qualifying tickets.
2. **Given** a project has SHIP tickets, **When** the user opens the Quality Gate drawer, **Then** a list of recent SHIP tickets is shown with each ticket's key, title, individual quality score, and score label.
3. **Given** a project has SHIP tickets spanning multiple weeks, **When** the user opens the Quality Gate drawer, **Then** a trend graph displays data points showing how the average quality score has evolved over time.

---

### User Story 3 - Last Clean Card Overview (Priority: P2)

A project owner navigates to the Health Dashboard and sees the Last Clean card displaying information about the most recent completed cleanup job: the date it ran, the number of files cleaned, remaining issues count, and a visual status indicator.

**Why this priority**: The Last Clean card provides at-a-glance cleanup status. It shares priority with the Quality Gate drawer since both are important for a complete dashboard experience.

**Independent Test**: Can be fully tested by creating a project with a completed cleanup job and verifying the card shows the correct date, files cleaned count, remaining issues, and appropriate status indicator.

**Acceptance Scenarios**:

1. **Given** a project has a completed cleanup job from 5 days ago that cleaned 12 files with 2 remaining issues, **When** the user opens the Health Dashboard, **Then** the Last Clean card shows "5 days ago", "12 files cleaned", "2 remaining issues", and status "OK".
2. **Given** a project has a completed cleanup job from 45 days ago, **When** the user opens the Health Dashboard, **Then** the Last Clean card shows a visual alert indicating the cleanup is overdue (more than 30 days old).
3. **Given** a project has never had a cleanup job, **When** the user opens the Health Dashboard, **Then** the Last Clean card shows "No cleanup yet" with no date or file count.
4. **Given** Last Clean has a score or status, **When** the global Health Score is calculated, **Then** Last Clean does NOT contribute to the score calculation.

---

### User Story 4 - Last Clean Drawer Detail (Priority: P3)

A project owner clicks on the Last Clean card to open the detail drawer. The drawer shows a summary of the most recent cleanup (files touched, changes made) and a history of past cleanups with dates and results.

**Why this priority**: The drawer provides historical context but is less critical than the card-level information. Users can still understand cleanup status from the card alone.

**Independent Test**: Can be fully tested by opening the Last Clean drawer and verifying the summary matches the last cleanup job's data and the history lists previous cleanups chronologically.

**Acceptance Scenarios**:

1. **Given** a project has a completed cleanup job, **When** the user opens the Last Clean drawer, **Then** the drawer shows a summary including files cleaned, remaining issues, and a text summary of changes.
2. **Given** a project has had 5 cleanup jobs over time, **When** the user opens the Last Clean drawer, **Then** the history section lists all cleanups in reverse chronological order with date, files cleaned, and result status.
3. **Given** a project has never had a cleanup job, **When** the user opens the Last Clean drawer, **Then** the drawer shows a "no data" state explaining that no cleanup has been run yet.

---

### User Story 5 - Quality Gate Integration with Global Health Score (Priority: P1)

The Quality Gate module's average score from the last 30 days is included in the global Health Score calculation at 20% weight, alongside the other contributing modules (Security, Compliance, Tests, Spec Sync).

**Why this priority**: Correct score integration is essential for the Health Score to be meaningful. This is tied to P1 because the global score must reflect Quality Gate data as soon as it's available.

**Independent Test**: Can be fully tested by verifying the global score calculation includes Quality Gate at the correct weight and that modules without data have their weight redistributed proportionally.

**Acceptance Scenarios**:

1. **Given** all 5 contributing modules have scores (Security: 80, Compliance: 90, Tests: 70, Spec Sync: 85, Quality Gate: 75), **When** the global score is calculated, **Then** the result is the average of all 5 scores: 80.
2. **Given** only Quality Gate (score 75) and Security (score 80) have data, **When** the global score is calculated, **Then** the result is the average of the two available scores: 78 (weights redistributed proportionally).
3. **Given** Quality Gate has no qualifying SHIP tickets in the last 30 days, **When** the global score is calculated, **Then** Quality Gate is excluded and its weight is redistributed among other scanned modules.

---

### Edge Cases

- What happens when a SHIP ticket has a completed verify job but no quality score recorded? It is excluded from the Quality Gate calculation.
- What happens when multiple verify jobs exist for the same ticket? Only the most recent completed verify job with a quality score is used per ticket.
- How does the system handle a cleanup job that is COMPLETED but has no log data (files cleaned / remaining issues)? The card shows the date with "0 files cleaned" and "0 remaining issues" as defaults.
- What happens when the 30-day window crosses a period with no activity? The trend calculation handles empty periods gracefully — if the previous period has zero tickets, trend shows "N/A".
- What happens when quality score details JSON is malformed or missing dimension data? Dimensions with missing data show "---" in the drawer breakdown; the overall score still uses the aggregate `qualityScore` field.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST calculate the Quality Gate score as the average of all `qualityScore` values from completed verify jobs on tickets at SHIP stage within the last 30 days for the given project.
- **FR-002**: System MUST display the Quality Gate card with: average score (0-100), number of qualifying SHIP tickets, trend indicator (comparison with previous 30-day period), and threshold distribution (Excellent/Good/Fair/Poor counts).
- **FR-003**: System MUST display a trend indicator on the Quality Gate card comparing the current 30-day average to the previous 30-day average. When the previous period has no data, the trend MUST show "N/A" or equivalent.
- **FR-004**: System MUST include the Quality Gate average score in the global Health Score at 20% weight (equal to other contributing modules). When no qualifying tickets exist, Quality Gate MUST be excluded from the global score with weight redistributed.
- **FR-005**: System MUST display the Quality Gate drawer with: per-dimension average scores (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync), a list of recent SHIP tickets with individual scores, and a trend graph showing score evolution over time.
- **FR-006**: System MUST display the Last Clean card with: date of last completed cleanup job, number of files cleaned, number of remaining issues (defaulting to 0 if unavailable), and a status indicator ("OK" if within 30 days, visual alert if older).
- **FR-007**: System MUST display the Last Clean drawer with: summary of the most recent cleanup job (files cleaned, changes summary) and a history of up to 10 past cleanup jobs in reverse chronological order.
- **FR-008**: Last Clean MUST NOT contribute to the global Health Score calculation.
- **FR-009**: Quality Gate data MUST be recalculated on every Health Dashboard page load (no caching of the 30-day aggregation beyond the page session).
- **FR-010**: Last Clean data MUST be derived from existing completed cleanup jobs — no new workflows or scan types are introduced.
- **FR-011**: Both modules MUST follow the existing passive module pattern: displaying a "passive" badge and no action button on their cards.
- **FR-012**: The Quality Gate drawer trend graph MUST display data points grouped by a reasonable time interval (e.g., weekly) to show score evolution.

### Key Entities *(include if feature involves data)*

- **Quality Gate Aggregate**: Represents the 30-day aggregation of quality scores from SHIP tickets. Key attributes: average score, ticket count, threshold distribution, per-dimension averages, trend vs. previous period. Derived from Job.qualityScore and Job.qualityScoreDetails on COMPLETED verify jobs linked to SHIP-stage tickets.
- **Last Clean Info**: Represents the most recent cleanup job result. Key attributes: completion date, files cleaned, remaining issues, text summary, staleness status. Derived from Job records with command "clean" and status "COMPLETED".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view the average quality score of their SHIP tickets for the last 30 days within 2 seconds of opening the Health Dashboard.
- **SC-002**: The Quality Gate trend indicator correctly reflects improvement or regression compared to the previous 30-day period in 100% of cases where both periods have data.
- **SC-003**: The global Health Score accurately includes Quality Gate at equal weight with other contributing modules, matching the expected calculation within ±1 point (rounding).
- **SC-004**: Users can identify whether their project needs a cleanup within 1 second by seeing the Last Clean card status (OK vs. overdue alert).
- **SC-005**: The Quality Gate drawer dimension breakdown enables users to identify their weakest quality dimension without navigating away from the Health Dashboard.
- **SC-006**: Last Clean does not affect the global Health Score under any circumstances — verified by comparing scores with and without cleanup data present.
- **SC-007**: All Quality Gate and Last Clean data displays correctly when the project has zero qualifying data (empty states are clear and non-confusing).
