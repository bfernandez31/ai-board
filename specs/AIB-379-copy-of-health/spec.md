# Feature Specification: Health Dashboard — Passive Modules Quality Gate & Last Clean

**Feature Branch**: `AIB-379-copy-of-health`
**Created**: 2026-03-29
**Status**: Draft
**Input**: User description: "Deux modules du Health Dashboard qui n'ont pas de scan actif mais affichent des données agrégées depuis les fonctionnalités existantes : les quality scores des tickets SHIP et les cleanup jobs."

## Auto-Resolved Decisions

### Decision 1 — Last Clean Staleness Thresholds

- **Decision**: Defined "recent" vs "stale" cleanup thresholds. A cleanup less than 30 days old shows "OK" status. Between 30–60 days shows a warning state. Over 60 days shows an alert state.
- **Policy Applied**: CONSERVATIVE (via AUTO fallback)
- **Confidence**: Low (0.3) — no explicit thresholds in the ticket description; "recent" and "ancien" are subjective terms
- **Fallback Triggered?**: Yes — AUTO scored netScore=+1, absScore=1 (below 3), confidence 0.3 < 0.5, promoted to CONSERVATIVE
- **Trade-offs**:
  1. Conservative thresholds may trigger warnings on projects with intentionally infrequent cleanups
  2. Provides clear visual feedback that encourages regular maintenance hygiene
- **Reviewer Notes**: Verify the 30/60-day thresholds align with typical project cleanup cadence. Adjust if projects commonly go longer between cleanups.

### Decision 2 — Last Clean Data Availability from Job Records

- **Decision**: The Last Clean module displays file count and remaining issues only when the cleanup job record contains this data. When unavailable, the card omits those fields gracefully rather than showing "N/A" or zeros. The drawer shows a summary message indicating limited data.
- **Policy Applied**: CONSERVATIVE (via AUTO fallback)
- **Confidence**: Low (0.3) — cleanup job logs may or may not contain structured file/issue counts depending on how the cleanup workflow reports results
- **Fallback Triggered?**: Yes — same AUTO→CONSERVATIVE fallback as above
- **Trade-offs**:
  1. Some cleanup cards may appear sparse if job data is incomplete
  2. Avoids displaying misleading zeros or fabricated data
- **Reviewer Notes**: Verify what structured data the cleanup workflow currently writes to job records. If file counts are not persisted, the card will show only the cleanup date and status.

### Decision 3 — Quality Gate Dimension Set

- **Decision**: The Quality Gate drawer displays all 5 existing quality score dimensions (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync) using the same dimension configuration already defined in the codebase. No new dimensions are introduced.
- **Policy Applied**: CONSERVATIVE (via AUTO fallback)
- **Confidence**: High (aligned with existing code — the dimension configuration is already defined and used by the verify workflow)
- **Fallback Triggered?**: Yes — AUTO fallback applied, but decision is straightforward
- **Trade-offs**:
  1. Spec Sync dimension has 0.00 weight in quality score calculation, so it contributes nothing to the aggregate but is still shown for transparency
  2. No additional configuration burden
- **Reviewer Notes**: Confirm whether showing the Spec Sync dimension (weight=0) in the drawer breakdown is desired or confusing to users.

## User Scenarios & Testing

### User Story 1 — View Quality Gate Score on Health Dashboard (Priority: P1)

A project owner navigates to the Health Dashboard and sees the Quality Gate card displaying the average quality score of all tickets that reached SHIP stage in the last 30 days. The card shows the score (0–100), the number of tickets evaluated, a trend indicator comparing to the previous 30-day period, and a distribution across quality thresholds (Excellent/Good/Fair/Poor).

**Why this priority**: The Quality Gate score is the primary deliverable — it provides actionable insight into code quality trends and contributes 20% to the global Health Score.

**Independent Test**: Can be fully tested by shipping tickets with quality scores, then loading the Health page and verifying the card displays the correct average, count, trend, and threshold distribution.

**Acceptance Scenarios**:

1. **Given** a project has 5 tickets at SHIP stage with COMPLETED verify jobs and quality scores in the last 30 days, **When** the user opens the Health Dashboard, **Then** the Quality Gate card shows the correct average score, "5 tickets" count, and the correct threshold distribution.
2. **Given** a project has tickets shipped in both the current and previous 30-day periods, **When** the user views the Quality Gate card, **Then** a trend indicator shows the score change (up/down/stable) compared to the previous period.
3. **Given** a project has no tickets shipped in the last 30 days, **When** the user views the Quality Gate card, **Then** the card shows "No data yet" with a score of "---".
4. **Given** the Quality Gate has a score, **When** the global Health Score is calculated, **Then** the Quality Gate contributes 20% to the global score using proportional weight redistribution.

---

### User Story 2 — Explore Quality Gate Details in Drawer (Priority: P2)

A project owner clicks the Quality Gate card to open a detail drawer. The drawer shows the average score per quality dimension, a list of recently shipped tickets with their individual scores, and a trend chart showing score evolution over time.

**Why this priority**: The dimension breakdown and ticket list transform the summary score into actionable intelligence — users can identify which quality dimensions are weakest and which tickets scored poorly.

**Independent Test**: Can be tested by clicking the Quality Gate card and verifying the drawer displays dimension averages, individual ticket scores, and a trend chart.

**Acceptance Scenarios**:

1. **Given** the Quality Gate card is visible with data, **When** the user clicks it, **Then** a drawer opens showing the average score for each of the 5 dimensions (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync).
2. **Given** the drawer is open, **When** the user scrolls down, **Then** they see a list of recently shipped tickets with each ticket's key, title, and individual quality score.
3. **Given** multiple tickets were shipped across different weeks, **When** the drawer is open, **Then** a trend chart displays score evolution over time (data points per ticket or per week).

---

### User Story 3 — View Last Clean Status on Health Dashboard (Priority: P2)

A project owner sees the Last Clean card on the Health Dashboard showing when the last cleanup was performed, a summary of what was cleaned, and a visual indicator of whether cleanup is overdue.

**Why this priority**: Provides visibility into maintenance hygiene without requiring any user action. The visual staleness indicator nudges teams to keep technical debt in check.

**Independent Test**: Can be tested by running a cleanup job to completion, then loading the Health Dashboard and verifying the Last Clean card displays the correct date, summary, and status indicator.

**Acceptance Scenarios**:

1. **Given** a project has a COMPLETED cleanup job from 10 days ago, **When** the user opens the Health Dashboard, **Then** the Last Clean card shows the cleanup date, "OK" status, and a summary (files cleaned count if available).
2. **Given** a project's last cleanup was 45 days ago, **When** the user views the Last Clean card, **Then** the card shows a warning visual state indicating the cleanup is aging.
3. **Given** a project's last cleanup was over 60 days ago, **When** the user views the Last Clean card, **Then** the card shows an alert visual state.
4. **Given** a project has never had a cleanup job, **When** the user views the Last Clean card, **Then** the card shows "No cleanup yet" with no score badge.
5. **Given** the Last Clean card has any status, **When** the global Health Score is calculated, **Then** the Last Clean module does NOT contribute to the score.

---

### User Story 4 — Explore Last Clean Details in Drawer (Priority: P3)

A project owner clicks the Last Clean card to open a detail drawer showing the summary of the most recent cleanup and a history of past cleanups.

**Why this priority**: The cleanup history provides context about maintenance patterns but is less critical than the at-a-glance card information.

**Independent Test**: Can be tested by clicking the Last Clean card and verifying the drawer shows the latest cleanup summary and a chronological list of past cleanups.

**Acceptance Scenarios**:

1. **Given** the Last Clean card shows a completed cleanup, **When** the user clicks it, **Then** a drawer opens showing a summary of the last cleanup (date, files touched, changes made).
2. **Given** the project has multiple completed cleanups, **When** the drawer is open, **Then** the user sees a chronological history of past cleanups with dates and results.
3. **Given** the project has no cleanup history, **When** the user clicks the Last Clean card, **Then** the drawer shows a message indicating no cleanups have been performed.

---

### Edge Cases

- What happens when a ticket reaches SHIP but its verify job has no quality score (e.g., QUICK workflow tickets)? → Only FULL workflow tickets with COMPLETED verify jobs and non-null quality scores are included in the Quality Gate calculation.
- What happens when all quality scores are from a single day? → The trend chart shows a single data point; the trend indicator shows "stable" (no previous period data to compare).
- What happens when a cleanup job is currently RUNNING? → The Last Clean card shows the most recent COMPLETED cleanup, not the in-progress one.
- What happens when the only cleanup job FAILED? → The Last Clean card shows "No cleanup yet" since no COMPLETED cleanup exists.

## Requirements

### Functional Requirements

- **FR-001**: System MUST calculate the Quality Gate score as the arithmetic average of quality scores from COMPLETED verify jobs of FULL-workflow tickets at SHIP stage, scoped to the last 30 days.
- **FR-002**: System MUST display the Quality Gate card with: average score (0–100), number of evaluated tickets, trend indicator (comparison with previous 30-day period), and threshold distribution (Excellent ≥90, Good ≥70, Fair ≥50, Poor <50).
- **FR-003**: System MUST display the Quality Gate drawer with: average score per dimension (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync), list of recent SHIP tickets with individual scores, and a trend chart over time.
- **FR-004**: System MUST include the Quality Gate average score as a 20% weight component in the global Health Score calculation, using the existing proportional weight redistribution algorithm.
- **FR-005**: System MUST display the Last Clean card with: date of the most recent COMPLETED cleanup job, file count (when available from job data), remaining issue count (when available), and a visual status indicator based on elapsed time since last cleanup.
- **FR-006**: System MUST apply staleness thresholds to the Last Clean card: "OK" when less than 30 days old, warning state between 30–60 days, alert state beyond 60 days.
- **FR-007**: System MUST display the Last Clean drawer with: summary of the latest cleanup (files touched, changes made), and a chronological history of past cleanups with dates and results.
- **FR-008**: System MUST NOT include the Last Clean module in the global Health Score calculation.
- **FR-009**: System MUST recalculate Quality Gate data on each Health Dashboard page load (no caching beyond the standard request lifecycle).
- **FR-010**: System MUST read Last Clean data from the most recent COMPLETED cleanup job record — no new workflows or scan triggers are created.
- **FR-011**: System MUST exclude QUICK-workflow tickets and tickets without quality scores from the Quality Gate calculation.
- **FR-012**: System MUST gracefully handle the absence of data — showing "No data yet" for Quality Gate and "No cleanup yet" for Last Clean when no qualifying records exist.

### Key Entities

- **Quality Gate Module**: Aggregated view of quality scores from shipped tickets. Key attributes: average score, ticket count, trend direction, dimension breakdown, threshold distribution.
- **Last Clean Module**: Status view of the project's most recent cleanup activity. Key attributes: last cleanup date, files cleaned count, remaining issues count, staleness status, cleanup history.
- **Quality Score Dimensions**: The 5 sub-scores that compose a ticket's quality score (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync), each with a name, weight, and average value across evaluated tickets.

## Assumptions

- Quality scores are already computed and stored on Job records by the verify workflow — no changes to the scoring pipeline are needed.
- Cleanup jobs are already tracked via the Job model with `command='clean'` and cleanup tickets use `workflowType='CLEAN'` — no schema changes are needed.
- The existing `HealthScore` model already has `qualityGate`, `lastCleanDate`, and `lastCleanJobId` fields that will be populated by this feature.
- The existing score calculator already includes `qualityGate` in its proportional weight redistribution — the 20% contribution is achieved by having it as one of 5 equally-weighted modules.
- Cleanup job records may not always contain structured file count or issue count data; the UI degrades gracefully when this data is absent.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The Quality Gate card displays the correct average score within 1 point of the mathematically expected value when compared against raw job data.
- **SC-002**: The trend indicator correctly reflects improvement, decline, or stability when comparing the current 30-day window against the previous 30-day window.
- **SC-003**: The global Health Score correctly incorporates the Quality Gate score at the expected weight, verified by comparing scores with and without the Quality Gate module.
- **SC-004**: The Last Clean card accurately reflects the date of the most recent completed cleanup job.
- **SC-005**: The Last Clean staleness indicator transitions correctly at the 30-day and 60-day boundaries.
- **SC-006**: Both modules display appropriate empty states when no qualifying data exists, with no errors or broken layouts.
- **SC-007**: The Quality Gate drawer displays all 5 dimension averages and the list of contributing tickets within 3 seconds of opening.
