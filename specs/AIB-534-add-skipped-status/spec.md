# Feature Specification: Add SKIPPED Status for Health Scans

**Feature Branch**: `AIB-534-add-skipped-status`
**Created**: 2026-04-04
**Status**: Draft
**Input**: User description: "Add SKIPPED status for health scans with nothing to evaluate"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Score handling for SKIPPED scans

- **Decision**: SKIPPED scans store `score: null` (not zero, not 100). The HealthScore aggregate for that module retains its previous value — a SKIPPED scan does not overwrite the last real score.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — internal feature with data integrity implications
- **Fallback Triggered?**: Yes — AUTO confidence below 0.5, promoted to CONSERVATIVE to protect score accuracy
- **Trade-offs**:
  1. Preserving the previous module score means the dashboard always shows the most recent *meaningful* result, avoiding stale "N/A" displays after one empty scan
  2. Requires additional logic in the status PATCH endpoint to skip the HealthScore upsert for SKIPPED scans
- **Reviewer Notes**: Verify that not updating HealthScore on SKIPPED is acceptable — if a module has *never* been scanned, it will remain null until a real scan completes

### Decision 2: Whether SKIPPED scans appear in scan history list

- **Decision**: SKIPPED scans appear in the scan history (they are real records), but are visually distinguished. The scan history API returns them with status SKIPPED and score null. Trend charts and sparklines exclude SKIPPED data points.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Keeping SKIPPED in history provides audit trail and transparency (users can see when a scan ran but found nothing to evaluate)
  2. Excluding from trend charts avoids misleading gaps or zero-score dips in visualizations
- **Reviewer Notes**: Confirm the scan detail drawer should show SKIPPED entries with a clear "Nothing to evaluate" message rather than hiding them

### Decision 3: Migration strategy for existing score-100 empty scans

- **Decision**: No retroactive migration. Existing COMPLETED scans with score 100 remain as-is. Only future scans benefit from the SKIPPED status. This preserves historical data integrity and avoids risky data manipulation.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — CONSERVATIVE fallback reinforces "no data mutation" stance
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Historical averages may still be slightly inflated by past empty scans scored at 100
  2. No migration risk, no data loss, no need for rollback strategy
- **Reviewer Notes**: Acceptance criterion #6 in the ticket explicitly requires this approach — existing history unaffected

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Health scan correctly reports nothing to evaluate (Priority: P1)

A project owner triggers a health scan (e.g., REVIEW_QUALITY) when no qualifying PRs have been merged since the last scan. Instead of receiving a misleading "score 100 — All clear" result, the scan completes with a SKIPPED status and a clear message explaining there was nothing to evaluate.

**Why this priority**: This is the core problem being solved — eliminating false-positive perfect scores that misrepresent project health.

**Independent Test**: Can be tested by triggering a REVIEW_QUALITY scan on a project with no recent PR merges and verifying the scan result shows SKIPPED status with no score.

**Acceptance Scenarios**:

1. **Given** a project with no qualifying PRs since the last REVIEW_QUALITY scan, **When** the scan workflow executes, **Then** the scan finishes with status SKIPPED, score null, and a report indicating "0 qualifying PRs found"
2. **Given** a project with no changed files since the last SECURITY scan (incremental mode), **When** the scan workflow executes, **Then** the scan finishes with status SKIPPED and score null
3. **Given** a project with no spec files in `specs/specifications/`, **When** a SPEC_SYNC scan runs, **Then** the scan finishes with status SKIPPED and score null

---

### User Story 2 - Dashboard displays SKIPPED scans distinctly (Priority: P2)

A project owner views the health dashboard after a scan was skipped. The module card shows a distinct visual treatment (e.g., grayed-out appearance, "N/A" badge) instead of a green "100" score badge. The previous meaningful score remains visible where applicable.

**Why this priority**: Without distinct display, users cannot distinguish between "everything was checked and is perfect" and "nothing was checked" — defeating the purpose of the SKIPPED status.

**Independent Test**: Can be tested by viewing the health dashboard for a project where the latest scan of a module was SKIPPED, and verifying the card shows the SKIPPED state distinctly.

**Acceptance Scenarios**:

1. **Given** a module whose most recent scan is SKIPPED, **When** the user views the health dashboard, **Then** the module card shows a distinct visual indicator (e.g., "N/A" or "Skipped" badge) rather than a numeric score
2. **Given** a module with a previous COMPLETED scan (score 85) followed by a SKIPPED scan, **When** the user views the dashboard, **Then** the module still displays score 85 as the current score (SKIPPED did not overwrite it)
3. **Given** a module that has only ever had SKIPPED scans, **When** the user views the dashboard, **Then** the module shows "No scan yet" or "N/A" with no numeric score

---

### User Story 3 - Trend statistics exclude SKIPPED scans (Priority: P2)

A project owner views health trend charts and aggregate statistics. SKIPPED scans are not counted as score data points, so averages and trend lines reflect only meaningful evaluation results.

**Why this priority**: Including SKIPPED scans in averages would inflate scores (treating "didn't check" as "perfect"), which is the exact problem this feature solves.

**Independent Test**: Can be tested by checking that the trends API and global score calculation exclude SKIPPED scans from their computations.

**Acceptance Scenarios**:

1. **Given** a module with scores [80, SKIPPED, 90, SKIPPED, 70], **When** the trend chart is rendered, **Then** only [80, 90, 70] appear as data points
2. **Given** a project where one module's only scan was SKIPPED, **When** the global health score is calculated, **Then** that module is excluded from the average (treated as null)
3. **Given** a scan history list filtered to a module, **When** the user opens the scan detail drawer, **Then** SKIPPED entries appear with a "Nothing to evaluate" summary but no score value

---

### User Story 4 - COMPLIANCE and TESTS_FIX scans are never SKIPPED (Priority: P3)

COMPLIANCE scans always have code to verify against the constitution, so they always produce a meaningful score. TESTS_FIX scans where 0 failing tests are found represent a legitimate positive result (score 100), not "nothing to evaluate."

**Why this priority**: Ensures the SKIPPED status is applied only where semantically correct, preventing misuse on scan types where the absence of findings is itself a valid result.

**Independent Test**: Can be tested by running COMPLIANCE and TESTS_FIX scans with minimal or no issues and verifying they complete with COMPLETED status and a score, never SKIPPED.

**Acceptance Scenarios**:

1. **Given** a COMPLIANCE scan with no violations found, **When** the scan completes, **Then** the status is COMPLETED with score 100 (not SKIPPED)
2. **Given** a TESTS_FIX scan with 0 failing tests, **When** the scan completes, **Then** the status is COMPLETED with score 100 (not SKIPPED)

---

### Edge Cases

- What happens when a scan type transitions from having data to having nothing? The next scan is SKIPPED; the module retains its last real score on the dashboard.
- What happens if all 5 scan types return SKIPPED in a nightly run? The global score remains at its previous value (no module scores are overwritten). The dashboard shows all modules in their SKIPPED visual state.
- What happens if the workflow fails to determine whether there is data to evaluate? The scan should proceed normally (not SKIPPED) and fall back to its existing behavior — SKIPPED is only for definitive "nothing to evaluate" cases.
- How does scan deduplication interact with SKIPPED? A SKIPPED scan is a terminal state. A new scan of the same type can be triggered immediately after a SKIPPED scan (no conflict with PENDING/RUNNING check).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a SKIPPED status in the health scan lifecycle, as a terminal state alongside COMPLETED and FAILED
- **FR-002**: System MUST allow the RUNNING → SKIPPED and PENDING → SKIPPED state transitions in the scan status update endpoint
- **FR-003**: System MUST NOT require a score when transitioning to SKIPPED status (score must be null)
- **FR-004**: System MUST NOT update the HealthScore aggregate (module score or global score) when a scan is SKIPPED
- **FR-005**: REVIEW_QUALITY scans MUST be SKIPPED when 0 qualifying PRs exist since the last scan
- **FR-006**: SECURITY scans MUST be SKIPPED when 0 changed files exist in incremental mode
- **FR-007**: SPEC_SYNC scans MUST be SKIPPED when 0 spec files exist in `specs/specifications/`
- **FR-008**: COMPLIANCE scans MUST never be SKIPPED — they always evaluate against the constitution
- **FR-009**: TESTS_FIX scans MUST never be SKIPPED — 0 failing tests is a valid positive result
- **FR-010**: Dashboard module cards MUST display SKIPPED scans with a distinct visual treatment (not as score 100)
- **FR-011**: Trend charts and sparklines MUST exclude SKIPPED scans from their data points
- **FR-012**: Global score calculation MUST exclude modules whose latest scan is SKIPPED (retain previous score)
- **FR-013**: Scan history API MUST return SKIPPED scans with their status and null score
- **FR-014**: Existing COMPLETED scans with score 100 MUST remain unchanged (no retroactive migration)
- **FR-015**: The scan detail drawer MUST display SKIPPED entries with a clear explanation message (e.g., "Nothing to evaluate")

### Key Entities *(include if feature involves data)*

- **HealthScan**: Existing entity gains a new SKIPPED terminal status value. When SKIPPED, score is null, report may contain a brief explanation of why the scan was skipped.
- **HealthScore**: Aggregate per-project entity. Not updated when a scan is SKIPPED — retains the most recent meaningful score for each module.
- **HealthScanStatus**: Enum extended with SKIPPED value. Valid transitions: PENDING → SKIPPED, RUNNING → SKIPPED.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of REVIEW_QUALITY scans with 0 qualifying PRs result in SKIPPED status (not COMPLETED with score 100)
- **SC-002**: 100% of SECURITY incremental scans with 0 changed files result in SKIPPED status
- **SC-003**: 100% of SPEC_SYNC scans with 0 spec files result in SKIPPED status
- **SC-004**: SKIPPED scans have zero impact on global health score averages — verified by comparing averages with and without SKIPPED records
- **SC-005**: Dashboard correctly distinguishes SKIPPED from scored states in all module cards — users can visually identify which modules were skipped vs. evaluated
- **SC-006**: No existing scan records are modified by this change — historical data integrity preserved

## Assumptions

- The health scan workflow result file (`/tmp/health-scan-result.json`) can be extended to include a `skipped` boolean or status field that the workflow reads to determine the terminal status
- The scan agents (Claude commands) can detect "nothing to evaluate" conditions early in their execution and exit with a SKIPPED indicator
- The PENDING → SKIPPED transition is needed for cases where the workflow itself determines there is nothing to evaluate before the agent runs (e.g., checking for changed files in the checkout step)
