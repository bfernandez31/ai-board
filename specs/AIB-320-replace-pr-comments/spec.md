# Feature Specification: Replace PR Comments Dimension with Spec Sync in Code Review

**Feature Branch**: `AIB-320-replace-pr-comments`
**Created**: 2026-03-20
**Status**: Draft
**Input**: User description: "Replace PR Comments dimension with Spec Sync in code review"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Whether Spec Sync should analyze all spec files in the repository or only those modified in the PR
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3) — feature description explicitly scopes to "specs modified in the PR" only
- **Fallback Triggered?**: No — ticket description is explicit; CONSERVATIVE aligns with stated scope
- **Trade-offs**:
  1. Narrower scope means new code that contradicts existing (unmodified) specs won't be caught
  2. Significantly faster analysis and lower false-positive rate since only relevant specs are checked
- **Reviewer Notes**: If broader spec coverage is desired in the future, the scope can be expanded without architectural changes

---

- **Decision**: How to handle the transition for historical data — existing jobs have `pr-comments` dimension scores stored in `qualityScoreDetails` JSON
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3) — preserving historical data is the safe default
- **Fallback Triggered?**: No — CONSERVATIVE naturally favors data preservation
- **Trade-offs**:
  1. Historical analytics will show "PR Comments" for past reviews and "Spec Sync" for new ones, which may confuse users briefly
  2. No data migration needed, reducing risk and complexity
- **Reviewer Notes**: Existing `qualityScoreDetails` JSON in the database is not modified. Old data retains `pr-comments` agent ID; new data uses `spec-sync`. Display components should handle both gracefully.

---

- **Decision**: Whether the dimension config should be a static TypeScript constant or a database-driven configuration
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3) — current system uses a TypeScript constant; maintaining the same pattern reduces risk
- **Fallback Triggered?**: No — keeping the existing pattern is inherently conservative
- **Trade-offs**:
  1. Config-as-code is simpler and type-safe but requires a deployment to change weights
  2. Database-driven would allow runtime changes but adds unnecessary complexity for a rarely-changed config
- **Reviewer Notes**: The ticket says "a single config drives both scoring and display" — a TypeScript config object satisfies this. Database-driven config can be added later if needed.

---

- **Decision**: Display label for the new dimension in analytics and ticket badges
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High — ticket title and description consistently use "Spec Sync"
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. "Spec Sync" is concise and descriptive
  2. Alternative "Specification Sync" is more formal but longer
- **Reviewer Notes**: Using "Spec Sync" as the display name, consistent with ticket terminology

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Code Review Produces Spec Sync Scores (Priority: P1)

When a code review runs during the VERIFY stage, the system executes a Spec Sync agent instead of the PR Comments agent. The agent checks whether specs modified in the PR are consistent with code changes in the same PR and produces a score (0-100).

**Why this priority**: This is the core replacement — without the agent producing scores, nothing else works.

**Independent Test**: Can be fully tested by running a code review on a PR that modifies both spec files and code files, and verifying the output includes a `spec-sync` dimension score.

**Acceptance Scenarios**:

1. **Given** a PR modifies `specs/specifications/endpoints.md` and `app/api/projects/route.ts`, **When** the code review runs, **Then** the Spec Sync agent analyzes consistency between those spec changes and code changes and returns a dimension score (0-100).
2. **Given** a PR modifies only code files (no spec files), **When** the code review runs, **Then** the Spec Sync agent returns a score of 100 with no issues.
3. **Given** a PR modifies only spec files (no code files), **When** the code review runs, **Then** the Spec Sync agent returns a score of 100 with no issues.

---

### User Story 2 - Dimension Configuration Drives Scoring and Display (Priority: P1)

A single configuration source defines all dimension names, agent IDs, weights, and display labels. Both the scoring computation and the UI display components read from this configuration, ensuring consistency.

**Why this priority**: The ticket explicitly requires that dimensions are not hardcoded — a single config drives both scoring and display. This is foundational to the architecture.

**Independent Test**: Can be tested by verifying that adding/removing/reordering a dimension in the config automatically reflects in both the computed score and the UI display without any other code changes.

**Acceptance Scenarios**:

1. **Given** the dimension config defines 5 dimensions with weights summing to 1.0 (across active dimensions), **When** the quality score is computed, **Then** the weighted sum uses exactly the weights from the config.
2. **Given** the dimension config includes Spec Sync with weight 0.00, **When** the quality score is computed, **Then** Spec Sync's score does not affect the global quality score.
3. **Given** the dimension config defines display labels, **When** the analytics dashboard or ticket detail renders dimension data, **Then** it uses the labels from the config (not hardcoded strings).

---

### User Story 3 - Updated Weights with Compliance at 0.40 (Priority: P2)

The dimension weights are rebalanced so that Compliance increases from 0.30 to 0.40, and Spec Sync replaces PR Comments at weight 0.00. The active weights (Compliance 0.40 + Bug Detection 0.30 + Code Comments 0.20 + Historical Context 0.10) sum to 1.00.

**Why this priority**: Weight rebalancing is a configuration change that depends on the config structure being in place (P1).

**Independent Test**: Can be tested by computing a quality score with known dimension scores and verifying the weighted result matches the new weight distribution.

**Acceptance Scenarios**:

1. **Given** all 5 agents return scores, **When** the quality score is computed, **Then** only the 4 active dimensions (weights > 0) contribute to the total, and the result equals `round(compliance*0.40 + bugDetection*0.30 + codeComments*0.20 + historicalContext*0.10)`.
2. **Given** the Spec Sync agent returns a score of 50, **When** the quality score is computed, **Then** the global score is identical to what it would be if Spec Sync scored 100 (weight 0.00 means no impact).

---

### User Story 4 - Analytics Display Shows Spec Sync (Priority: P2)

The analytics dashboard and ticket detail view display Spec Sync as a dimension instead of PR Comments. Historical data with the old `pr-comments` dimension continues to display correctly.

**Why this priority**: Display is important but depends on the scoring and config changes being in place first.

**Independent Test**: Can be tested by viewing analytics for a project that has both old (pr-comments) and new (spec-sync) quality score data, and verifying both display correctly with their respective labels.

**Acceptance Scenarios**:

1. **Given** a ticket has a quality score computed after this change, **When** the user views the ticket's quality score breakdown, **Then** "Spec Sync" appears as a dimension with its score and weight (0.00).
2. **Given** a ticket has a quality score computed before this change, **When** the user views the ticket's quality score breakdown, **Then** "PR Comments" still appears with its historical score and weight.
3. **Given** the analytics dimension comparison chart aggregates scores, **When** the user views the chart, **Then** it shows the current dimension names from the config.

---

### Edge Cases

- What happens when the Spec Sync agent encounters spec files that are not in `specs/specifications/` (e.g., in `specs/[ticket-key]/`)? The agent only analyzes files matching `specs/specifications/**/*.md` as stated in the ticket.
- How does the system handle a PR that modifies a very large number of spec files? The agent processes all modified spec files without a cap — a practical limit is unlikely since spec files are small and PRs rarely touch many at once.
- What happens when historical `qualityScoreDetails` JSON contains `pr-comments` but the current config no longer has it? Display components fall back to the `name` field stored in the JSON for historical records, preserving the original label.
- What if a dimension config has all weights at 0.00? The quality score would be 0 regardless of individual scores. This is a degenerate case the system handles naturally (weighted sum of zeros).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST replace the PR Comments dimension with a Spec Sync dimension in the code review agent configuration
- **FR-002**: System MUST define a single configuration source for all dimensions that includes agent ID, display name, weight, and agent prompt/behavior
- **FR-003**: The Spec Sync agent MUST analyze only spec files (`specs/specifications/**/*.md`) that are modified in the current PR
- **FR-004**: The Spec Sync agent MUST check for contradictions between spec content and code changes in the same PR
- **FR-005**: The Spec Sync agent MUST check for gaps where specs document behavior absent from code, or code adds behavior not covered by specs
- **FR-006**: The Spec Sync agent MUST return a score of 100 with no issues when no spec files are modified in the PR
- **FR-007**: System MUST set Compliance weight to 0.40 (was 0.30), Bug Detection to 0.30, Code Comments to 0.20, Historical Context to 0.10, and Spec Sync to 0.00
- **FR-008**: Active dimension weights (those > 0) MUST sum to 1.00
- **FR-009**: Spec Sync score MUST be computed and stored in the `qualityScoreDetails` JSON but MUST NOT affect the global `qualityScore` value or threshold
- **FR-010**: Analytics and ticket badge display MUST read dimension names and labels from the configuration, not from hardcoded strings
- **FR-011**: Display components MUST handle historical `qualityScoreDetails` data that contains the old `pr-comments` dimension gracefully
- **FR-012**: The total number of code review agents MUST remain at 5 (replacement, not addition)

### Key Entities *(include if feature involves data)*

- **Dimension Configuration**: Defines each code review dimension — agent ID (unique identifier), display name (human-readable label), weight (0.00-1.00), and ordering. Single source of truth for scoring logic and UI display.
- **DimensionScore**: Existing entity (stored in `qualityScoreDetails` JSON) — contains name, agentId, score, weight, and weightedScore for each dimension in a completed review.
- **QualityScoreDetails**: Existing entity (JSON string on Job model) — contains the array of DimensionScores, threshold label, and computation timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Code reviews produce 5 dimension scores where Spec Sync replaces PR Comments, with no change to total agent count
- **SC-002**: Quality scores computed after the change reflect the new weight distribution (Compliance 0.40, Bug Detection 0.30, Code Comments 0.20, Historical Context 0.10, Spec Sync 0.00)
- **SC-003**: PRs that modify spec files alongside code receive a meaningful Spec Sync score (not always 100) that reflects consistency between specs and code
- **SC-004**: PRs that do not modify any spec files receive a Spec Sync score of exactly 100
- **SC-005**: The quality gate (Excellent/Good/Fair/Poor thresholds) remains unchanged — active weights sum to 1.00 and threshold boundaries are unaffected
- **SC-006**: All dimension labels in the analytics dashboard and ticket detail view are driven by a single configuration source, with zero hardcoded dimension names in display components
- **SC-007**: Historical quality score data (containing `pr-comments` dimension) continues to display correctly without data migration
