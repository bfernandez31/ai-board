# Feature Specification: Add SKIPPED Status for Health Scans With Nothing to Evaluate

**Feature Branch**: `AIB-535-copy-of-add`
**Created**: 2026-04-04
**Status**: Draft
**Input**: User description: "Add SKIPPED status for health scans with nothing to evaluate"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Dashboard Visual Treatment for SKIPPED Scans

- **Decision**: SKIPPED scans display a muted/grayed-out card with a "Skipped" label and a brief reason (e.g., "No PRs to evaluate"). No numeric score is shown — the score area displays "N/A" instead of a number.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score -1, absScore 1)
- **Fallback Triggered?**: Yes — AUTO confidence below 0.5 triggered CONSERVATIVE fallback
- **Trade-offs**:
  1. Clear distinction prevents misinterpreting SKIPPED as a perfect score, improving data integrity
  2. Requires additional UI state handling for the "no score" case across all dashboard components
- **Reviewer Notes**: Confirm "Skipped" label wording and visual style (grayed-out treatment) match the existing design language of the health dashboard

### Decision 2: SKIPPED Scan Behavior in Trend and Sparkline Charts

- **Decision**: SKIPPED scans are excluded from trend sparklines, average calculations, and cumulative statistics. They do not appear as data points in charts. If the most recent scan is SKIPPED, the module card shows the last COMPLETED score (if any) alongside the "Skipped" indicator for the latest scan.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score -1, absScore 1)
- **Fallback Triggered?**: Yes — CONSERVATIVE fallback to avoid inflating averages
- **Trade-offs**:
  1. Prevents artificial inflation of health scores when no evaluation occurred
  2. Gaps in trend data may look confusing if many consecutive scans are SKIPPED
- **Reviewer Notes**: Verify that the trends API correctly filters out SKIPPED results and that sparkline components handle sparse data gracefully

### Decision 3: Detection Responsibility — Agent vs Workflow

- **Decision**: Each health scan agent (LLM command) is responsible for detecting "nothing to evaluate" early in its execution. When detected, the agent writes a result file with score `null` and a `skipped: true` indicator. The workflow reads this indicator and sets the scan status to SKIPPED (rather than COMPLETED) when updating the API.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score -1, absScore 1)
- **Fallback Triggered?**: Yes — CONSERVATIVE fallback ensures clear separation of concerns
- **Trade-offs**:
  1. Keeps detection logic close to domain knowledge (each agent knows its own "empty" condition)
  2. Requires updating all affected agent commands and the workflow's status-update logic
- **Reviewer Notes**: Confirm the result JSON schema change (adding `skipped` field) is backward-compatible with existing workflow parsing

## User Scenarios & Testing *(mandatory)*

### User Story 1 - SKIPPED Scan Displays Accurately on Dashboard (Priority: P1)

A project owner views the health dashboard after a nightly scan run. One of the scan types (e.g., REVIEW_QUALITY) had nothing to evaluate because no PRs were merged since the last scan. Instead of seeing a misleading score of 100, the owner sees a clearly distinct "Skipped" indicator on that module card with an explanation like "No qualifying PRs since last scan." The global health score excludes this module from its calculation.

**Why this priority**: This is the core user-facing value — preventing misleading scores from reaching the dashboard.

**Independent Test**: Can be fully tested by triggering a health scan for a project with no qualifying PRs and verifying the dashboard renders the SKIPPED state correctly with no numeric score.

**Acceptance Scenarios**:

1. **Given** a project with no merged PRs since the last REVIEW_QUALITY scan, **When** a new REVIEW_QUALITY scan completes, **Then** the scan status is SKIPPED with a null score, and the dashboard module card shows "Skipped" with a reason instead of score 100
2. **Given** a project with no spec files in `specs/specifications/`, **When** a SPEC_SYNC scan completes, **Then** the scan status is SKIPPED with a null score
3. **Given** a project with no changed files in incremental SECURITY mode, **When** a SECURITY scan completes, **Then** the scan status is SKIPPED with a null score
4. **Given** a COMPLIANCE scan, **When** the scan runs regardless of code changes, **Then** the scan always completes as COMPLETED with a valid score (never SKIPPED)
5. **Given** a TESTS scan with 0 failing tests, **When** the scan completes, **Then** the scan status is COMPLETED with score 100 (not SKIPPED — zero failures is a legitimate positive result)

---

### User Story 2 - Global Score and Trends Exclude SKIPPED Scans (Priority: P2)

A project owner reviews the global health score and trend charts. SKIPPED scans do not inflate averages or appear as data points on sparklines. The global score is calculated only from modules that have a COMPLETED scan with an actual score.

**Why this priority**: Ensures data integrity in aggregate metrics and historical analysis.

**Independent Test**: Can be tested by running scans where some types are SKIPPED and verifying the global score calculation and trend data exclude them.

**Acceptance Scenarios**:

1. **Given** a project where REVIEW_QUALITY and SPEC_SYNC scans are SKIPPED, **When** the global health score is calculated, **Then** only COMPLETED module scores contribute to the average
2. **Given** a series of scans for a module where some are SKIPPED, **When** the trends API returns data, **Then** SKIPPED scans are excluded from the trend data points
3. **Given** all scans for a project are SKIPPED (except COMPLIANCE which never skips), **When** the global score is calculated, **Then** only the COMPLIANCE score contributes

---

### User Story 3 - Scan Agents Detect Nothing to Evaluate and Exit Early (Priority: P2)

Health scan agents detect their "nothing to evaluate" condition early in execution. They write an appropriate result indicating SKIPPED status and exit without performing unnecessary analysis, saving time and cost.

**Why this priority**: Reduces wasted compute and ensures the SKIPPED status propagates correctly through the system.

**Independent Test**: Can be tested by running each affected scan type in an environment with nothing to evaluate and verifying the result file contains the SKIPPED indicator.

**Acceptance Scenarios**:

1. **Given** the REVIEW_QUALITY agent runs with 0 qualifying PRs, **When** it detects this condition, **Then** it writes a result with `skipped: true` and `score: null` and exits early
2. **Given** the SECURITY agent runs in incremental mode with 0 changed files, **When** it detects this condition, **Then** it writes a result with `skipped: true` and `score: null`
3. **Given** the SPEC_SYNC agent runs with 0 spec files, **When** it detects this condition, **Then** it writes a result with `skipped: true` and `score: null`
4. **Given** the workflow reads a result with `skipped: true`, **When** it updates the scan status via the API, **Then** it sets the status to SKIPPED with a null score

---

### User Story 4 - Existing Scan History Preserved (Priority: P3)

Past health scan data remains unchanged. Historical scans that completed with score 100 when nothing was evaluated retain their original status and score. The SKIPPED status only applies to new scans going forward.

**Why this priority**: Data integrity — no retroactive changes to historical records.

**Independent Test**: Can be tested by verifying that the database migration adds the new enum value without modifying existing records.

**Acceptance Scenarios**:

1. **Given** existing COMPLETED scans with score 100 from before this feature, **When** the database migration runs, **Then** those scans retain their COMPLETED status and score 100
2. **Given** the new SKIPPED enum value is added, **When** querying historical scan data, **Then** no existing records have the SKIPPED status

---

### Edge Cases

- What happens when a scan agent crashes before determining whether to skip? The existing FAILED status handling applies — no change needed.
- How does the system handle a module that has only SKIPPED scans and no historical COMPLETED scans? The module card shows "Skipped" with no score and no trend data. The global score excludes this module entirely.
- What if COMPLIANCE or TESTS scan types somehow produce a `skipped: true` result? The workflow should ignore the skipped indicator for these types and treat them as COMPLETED (defensive guard).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a SKIPPED value in the health scan status lifecycle, alongside PENDING, RUNNING, COMPLETED, and FAILED
- **FR-002**: When a REVIEW_QUALITY scan finds 0 qualifying PRs since the last scan, the system MUST set the scan status to SKIPPED with a null score
- **FR-003**: When a SECURITY scan in incremental mode finds 0 changed files to scan, the system MUST set the scan status to SKIPPED with a null score
- **FR-004**: When a SPEC_SYNC scan finds 0 spec files in `specs/specifications/`, the system MUST set the scan status to SKIPPED with a null score
- **FR-005**: COMPLIANCE scans MUST never be SKIPPED — they always evaluate against the constitution
- **FR-006**: TESTS scans with 0 failing tests MUST complete as COMPLETED with score 100 — zero failures is a legitimate result, not "nothing to evaluate"
- **FR-007**: The dashboard MUST display SKIPPED scans with a distinct visual treatment (muted/grayed-out appearance, "Skipped" label, reason text) instead of a numeric score
- **FR-008**: The global health score calculation MUST exclude modules whose most recent scan is SKIPPED
- **FR-009**: Trend and sparkline data MUST exclude SKIPPED scans — they do not count as data points
- **FR-010**: Average score calculations MUST exclude SKIPPED scans to prevent artificial inflation
- **FR-011**: Existing historical scan records MUST NOT be modified by this feature — past COMPLETED scans with score 100 remain unchanged
- **FR-012**: The scan result format MUST include an indicator for the agent to signal "nothing to evaluate" to the workflow
- **FR-013**: The workflow MUST map the agent's "nothing to evaluate" indicator to the SKIPPED status when updating the scan via the API

### Key Entities

- **HealthScan**: Existing entity, extended with SKIPPED status. When SKIPPED, score is null and the report contains a reason for skipping.
- **HealthScore**: Existing aggregate entity. Global score recalculation must handle null module scores from SKIPPED scans by excluding them from the average.
- **HealthScanStatus**: Existing enum, extended with a fifth value: SKIPPED.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of health scans with nothing to evaluate result in SKIPPED status (not COMPLETED with score 100) after this feature is deployed
- **SC-002**: Global health score accuracy improves — no modules with artificial 100 scores from empty evaluations contribute to the average
- **SC-003**: Dashboard correctly renders SKIPPED state for all affected scan types without displaying a numeric score
- **SC-004**: Trend charts and historical averages exclude SKIPPED scans, showing only meaningful data points
- **SC-005**: Zero existing historical scan records are modified by the migration or feature rollout

## Assumptions

- The `skipped` indicator in the result JSON is a new boolean field added alongside the existing `score`, `issuesFound`, and `report` fields
- The SKIPPED status is terminal (like COMPLETED and FAILED) — no transitions from SKIPPED to other states
- The stale scan auto-fail logic (>65 minutes) does not need to account for SKIPPED since agents exit early when skipping
- Quality Gate (passive, non-scannable module) is unaffected by this feature since it derives scores from verify jobs, not health scans
