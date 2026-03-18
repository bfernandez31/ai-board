# Feature Specification: Automatic Quality Score via Code Review

**Feature Branch**: `AIB-303-automatic-quality-score`
**Created**: 2026-03-17
**Status**: Draft
**Input**: User description: "Extend the existing code review command so each review agent returns a dimension score (0-100) alongside its issues. A weighted final score is computed and stored on the verify job."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Score visibility — all project members (owners and members) can view quality scores, not just owners
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — neutral feature context (+1) offset by internal tooling signal (-2), netScore = -1, absScore = 1
- **Fallback Triggered?**: Yes — confidence < 0.5, AUTO promoted to CONSERVATIVE
- **Trade-offs**:
  1. Broader visibility increases transparency and team accountability
  2. No additional access control complexity needed
- **Reviewer Notes**: If score visibility should be restricted (e.g., owner-only), update before implementation

---

- **Decision**: Score immutability — quality scores are read-only after computation; no manual editing or deletion
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — scores represent objective automated assessments; manual override would undermine trust
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Preserves audit integrity and prevents score manipulation
  2. If a score is computed from a flawed review, the only recourse is re-running VERIFY (rollback-reset flow)
- **Reviewer Notes**: This aligns with existing job telemetry immutability patterns

---

- **Decision**: Analytics access — quality score analytics follow the same subscription gating as existing analytics (Team plan only)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — consistent with existing analytics dashboard access control
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Maintains consistent monetization strategy
  2. Free/Pro users can still see individual scores on ticket cards and Stats tab
- **Reviewer Notes**: Verify this matches current analytics subscription gating behavior

---

- **Decision**: Score display on ticket card — show score as a small colored badge only when a score exists (FULL workflow VERIFY jobs that completed successfully)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — avoids cluttering cards for QUICK/CLEAN workflows that never produce scores
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Clean UI for tickets without scores
  2. Users must understand that absence of badge means "not applicable" rather than "not yet scored"
- **Reviewer Notes**: Consider tooltip on badge hover explaining the score

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Quality Score on Ticket Card (Priority: P1)

A project owner or member views the board and sees a small colored badge on ticket cards that have completed the VERIFY stage via the FULL workflow. The badge color indicates score quality at a glance: green for excellent, blue for good, amber for fair, red for poor.

**Why this priority**: This is the primary touchpoint — users see quality scores every time they look at the board, providing immediate feedback on AI code quality without extra clicks.

**Independent Test**: Can be fully tested by completing a VERIFY job with a quality score and confirming the badge appears on the ticket card with the correct color threshold.

**Acceptance Scenarios**:

1. **Given** a ticket with a COMPLETED verify job that has a quality score of 92, **When** the user views the board, **Then** the ticket card displays a green badge showing "92"
2. **Given** a ticket with a COMPLETED verify job that has a quality score of 75, **When** the user views the board, **Then** the ticket card displays a blue badge showing "75"
3. **Given** a ticket with a COMPLETED verify job that has a quality score of 55, **When** the user views the board, **Then** the ticket card displays an amber badge showing "55"
4. **Given** a ticket with a COMPLETED verify job that has a quality score of 38, **When** the user views the board, **Then** the ticket card displays a red badge showing "38"
5. **Given** a QUICK workflow ticket, **When** the user views the board, **Then** no quality score badge appears on the ticket card
6. **Given** a FULL workflow ticket whose verify job failed, **When** the user views the board, **Then** no quality score badge appears

---

### User Story 2 - View Quality Score in Ticket Stats Tab (Priority: P1)

A user opens the ticket detail modal and navigates to the Stats tab. For FULL workflow tickets with a completed VERIFY job, a quality score section appears showing the overall score, the threshold label (Excellent/Good/Fair/Poor), and a breakdown of all five dimension scores with their weights.

**Why this priority**: The Stats tab provides the detailed view that complements the card badge, allowing users to understand which dimensions contributed to the score.

**Independent Test**: Can be tested by opening the Stats tab on a ticket with quality score data and verifying all dimension scores and the weighted total are displayed.

**Acceptance Scenarios**:

1. **Given** a ticket with a completed verify job scoring 85 overall, **When** the user opens the Stats tab, **Then** the overall score "85" is displayed with the "Good" label in blue, along with all five dimension sub-scores and their weights
2. **Given** a ticket with multiple verify jobs (after rollback-reset), **When** the user opens the Stats tab, **Then** the score displayed is from the latest COMPLETED verify job only
3. **Given** a ticket with no quality score (QUICK workflow or failed verify), **When** the user opens the Stats tab, **Then** no quality score section appears

---

### User Story 3 - Quality Score Computation During VERIFY (Priority: P1)

After the VERIFY workflow completes successfully for a FULL workflow ticket, the code review agents each produce a dimension score (0-100) alongside their issues. The system computes a weighted final score and stores it on the verify job record.

**Why this priority**: This is the core scoring engine — without it, no scores exist to display anywhere.

**Independent Test**: Can be tested by triggering a VERIFY workflow for a FULL ticket and confirming the job record contains the computed quality score.

**Acceptance Scenarios**:

1. **Given** a FULL workflow ticket in VERIFY stage, **When** the verify workflow completes successfully and code review runs, **Then** each of the 5 review agents returns a sub-score (0-100) for its dimension
2. **Given** agent sub-scores of Bug Detection: 90, Compliance: 80, Code Comments: 70, Historical Context: 85, PR Comments: 95, **When** the final score is computed, **Then** the result is round(90×0.30 + 80×0.30 + 70×0.20 + 85×0.10 + 95×0.10) = round(27 + 24 + 14 + 8.5 + 9.5) = 83
3. **Given** the computed score is 83, **When** the workflow updates the job status, **Then** the job record stores `qualityScore = 83`
4. **Given** a QUICK workflow ticket, **When** the verify workflow runs, **Then** no quality score is computed or stored
5. **Given** a CLEAN workflow ticket, **When** the verify workflow runs, **Then** no quality score is computed or stored
6. **Given** a FULL workflow verify job that fails or is cancelled, **When** the job reaches terminal state, **Then** no quality score is stored

---

### User Story 4 - Quality Score Analytics (Priority: P2)

Team plan users view the analytics dashboard and see quality score trends: an average quality score over time chart, a per-agent-dimension comparison, and a trend line showing score evolution across tickets.

**Why this priority**: Analytics provide strategic insight into AI code quality over time but are secondary to the core scoring and per-ticket display.

**Independent Test**: Can be tested by having multiple tickets with quality scores and confirming the analytics charts render with correct aggregated data.

**Acceptance Scenarios**:

1. **Given** a Team plan user with 10+ tickets that have quality scores, **When** they view the analytics dashboard, **Then** an average quality score over time chart is displayed showing score trends
2. **Given** quality score data across multiple tickets, **When** the user views the analytics dashboard, **Then** a per-dimension comparison shows average scores for each of the 5 scoring dimensions
3. **Given** a user on Free or Pro plan, **When** they view the analytics dashboard, **Then** quality score analytics are gated behind the Team plan upgrade prompt (consistent with existing analytics gating)
4. **Given** no tickets with quality scores in the selected time range, **When** the user views analytics, **Then** a contextual empty state message is shown for the quality score section

---

### Edge Cases

- What happens when a verify job completes but the code review command fails to produce scoring output? The job stores `qualityScore = null` and no badge is displayed.
- What happens when a ticket has multiple verify jobs from rollback-reset cycles? Only the latest COMPLETED verify job's score is displayed; prior scores are retained in the database but not surfaced in the UI.
- What happens when dimension scores are at boundary values (exactly 0 or exactly 100)? The system accepts any integer 0-100 inclusive; thresholds apply normally (100 = Excellent, 0 = Poor).
- What happens when the weighted sum results in a non-integer? The final score is rounded to the nearest integer using standard rounding (e.g., 83.5 rounds to 84).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store a `qualityScore` field on the Job model as a nullable integer, populated only for COMPLETED verify jobs of FULL workflow tickets
- **FR-002**: The code review command MUST be extended so each of the 5 review agents returns a sub-score (0-100) for its assigned dimension alongside its issue list
- **FR-003**: System MUST compute the final quality score as the weighted sum of dimension scores: Bug Detection (30%), Compliance (30%), Code Comments (20%), Historical Context (10%), Previous PR Comments (10%), rounded to the nearest integer
- **FR-004**: The code review command MUST write a structured scoring output (JSON) to the workspace containing all dimension scores, weights, and the computed final score
- **FR-005**: The verify workflow MUST parse the scoring JSON output and send the final score via the existing job status update endpoint
- **FR-006**: The job status update endpoint MUST accept and persist the quality score when provided
- **FR-007**: System MUST NOT compute or store quality scores for QUICK workflow tickets, CLEAN workflow tickets, or failed/cancelled verify jobs
- **FR-008**: System MUST display the quality score as a small colored badge on ticket cards, using threshold colors: Excellent (90-100, green), Good (70-89, blue), Fair (50-69, amber), Poor (0-49, red)
- **FR-009**: System MUST display quality score details in the ticket detail Stats tab, including overall score, threshold label, and all five dimension sub-scores with weights
- **FR-010**: When multiple verify jobs exist for a ticket (rollback-reset scenario), the system MUST display the score from the latest COMPLETED verify job
- **FR-011**: System MUST provide quality score analytics on the analytics dashboard: average score over time, per-dimension comparison, and trend line
- **FR-012**: Quality score analytics MUST follow the same subscription gating as existing analytics features (Team plan)
- **FR-013**: Quality scores MUST be read-only — no manual editing or deletion after computation

### Key Entities *(include if feature involves data)*

- **Quality Score**: An integer (0-100) representing the overall code quality assessment, stored on the Job record. Composed of five weighted dimension sub-scores. Only exists for COMPLETED verify jobs in FULL workflow tickets.
- **Dimension Score**: A sub-score (0-100) for one of five review dimensions (Bug Detection, Compliance, Code Comments, Historical Context, PR Comments). Produced by the corresponding code review agent. Stored as part of the structured scoring output.
- **Score Threshold**: A classification of the quality score into human-readable quality levels: Excellent (90+), Good (70-89), Fair (50-69), Poor (<50). Used for badge coloring and labels.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every FULL workflow ticket that completes VERIFY successfully has a quality score visible within the ticket card badge and Stats tab
- **SC-002**: Quality scores are computed and stored within the existing verify workflow execution time (no separate job or additional workflow step required)
- **SC-003**: Users can identify code quality at a glance — the colored badge on ticket cards communicates quality level without requiring a click
- **SC-004**: Team plan users can track quality trends over time and identify which scoring dimensions need improvement via the analytics dashboard
- **SC-005**: Score computation is deterministic — given the same five dimension sub-scores, the final score is always the same weighted sum
- **SC-006**: Rollback-reset scenarios display only the most recent score, ensuring users always see the current quality assessment
