# Feature Specification: Persist Structured Decision Points in Comparison Data

**Feature Branch**: `AIB-352-persist-structured-decision`  
**Created**: 2026-03-26  
**Status**: Draft  
**Input**: User description: "Persist structured decision points in comparison data"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: AUTO policy resolved to CONSERVATIVE because this is a user-facing comparison feature with data-integrity impact and no speed-first or internal-only signals.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3 — three neutral feature-context signals: user-facing comparison dialog, persisted comparison data, and acceptance criteria focused on correctness; zero conflicting buckets)
- **Fallback Triggered?**: No — medium confidence met the AUTO threshold without forcing a fallback
- **Trade-offs**:
  1. Adds stricter expectations for preserving comparison-time fidelity and graceful degradation for legacy records
  2. Slightly narrows flexibility in how incomplete decision-point data may be stored for new comparisons
- **Reviewer Notes**: Confirm the team wants correctness and backward compatibility prioritized over a lighter-weight partial fix

---

- **Decision**: Newly generated comparisons will treat each decision point as its own saved comparison artifact rather than inheriting shared report-level winner and rationale fields.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — the problem statement explicitly identifies shared fallback fields as the defect
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prevents repeated generic content and preserves the distinctions the AI already produces in the markdown analysis
  2. Requires comparison generation to reject or clearly flag incomplete decision-point entries instead of silently cloning global report text
- **Reviewer Notes**: Validate that new comparisons should favor distinct saved decision-point content even if that means omitting a malformed item rather than inventing details

---

- **Decision**: Existing saved comparisons without decision-point-specific structured data will continue using the current report-level fallback behavior.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — explicitly required in the acceptance criteria
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Preserves access to historical comparison records without requiring backfill work
  2. Legacy records may still show repeated generic content until they are regenerated
- **Reviewer Notes**: Confirm that preserving historical readability is preferable to hiding incomplete legacy decision points

---

- **Decision**: The structured comparison payload and the human-readable comparison report must describe the same set of decision points for a single comparison run.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium — the request states the richer data already exists in markdown and should be captured structurally
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Reduces drift between the persisted dashboard data and the comparison narrative users read in markdown
  2. Introduces stricter validation expectations for comparison generation output
- **Reviewer Notes**: Confirm whether minor wording differences are acceptable as long as the title, verdict, rationale, and per-ticket approaches remain materially aligned

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review Distinct Decision Points in the Comparison Dialog (Priority: P1)

A project member opens a saved ticket comparison and expands the Decision Points section. Each accordion item shows its own title, winning verdict, rationale, and per-ticket approach summary, allowing the member to understand how the compared implementations differ without reading the raw markdown report.

**Why this priority**: This is the broken user-facing behavior the feature exists to fix. If decision points still repeat generic content, the comparison dialog remains misleading.

**Independent Test**: Can be fully tested by viewing a comparison generated from tickets with multiple distinct implementation choices and verifying each decision point displays unique content that matches the saved comparison analysis.

**Acceptance Scenarios**:

1. **Given** a comparison with multiple saved decision points, **When** the user expands each accordion item in the Decision Points section, **Then** each item shows a distinct title, verdict summary, rationale, and per-ticket approach description for that specific decision.
2. **Given** a decision point where different tickets used different approaches, **When** the user views the participant approach list, **Then** each listed ticket shows the approach summary associated with that decision point rather than a repeated global summary.
3. **Given** a comparison where one decision point names Ticket A as the preferred approach and another names Ticket B, **When** the user reviews both items, **Then** each decision point preserves its own winner and rationale without being overwritten by report-level recommendation text.

---

### User Story 2 - Preserve Backward Compatibility for Historical Comparisons (Priority: P1)

A project member opens an older comparison that was saved before distinct decision-point fields were persisted. The comparison still loads successfully and continues to show the current fallback content rather than failing or showing empty sections.

**Why this priority**: Historical comparisons are already stored and remain valuable. The fix cannot make previously saved comparisons unreadable.

**Independent Test**: Can be fully tested by opening a comparison record created before this feature and confirming the Decision Points section still renders using the existing fallback behavior.

**Acceptance Scenarios**:

1. **Given** an existing comparison record without per-decision structured fields, **When** the user opens the comparison dialog, **Then** the Decision Points section still renders using the current fallback behavior.
2. **Given** a project that contains both older and newer comparisons, **When** the user opens each type of record, **Then** legacy comparisons use fallback content and newer comparisons show decision-specific content without any manual migration step.

---

### User Story 3 - Save Decision-Point Structure at Comparison Time (Priority: P2)

A user runs a new comparison and expects the saved comparison record to preserve the same decision-point structure that appears in the AI-generated comparison report. Later viewers can rely on the dialog data without needing the markdown as the source of truth.

**Why this priority**: The dialog can only remain accurate if the structured comparison record captures the decision-point details at creation time.

**Independent Test**: Can be fully tested by generating a new comparison, examining the saved comparison record through the product surface, and confirming the decision points align with the newly generated report content.

**Acceptance Scenarios**:

1. **Given** a new comparison completes successfully, **When** its result is saved, **Then** the saved comparison data includes a distinct structured entry for every decision point produced in that comparison.
2. **Given** a new comparison contains three or more decision points, **When** the user views the saved comparison later, **Then** the same number of decision points appears in the dialog in the same comparison outcome.
3. **Given** the comparison generation flow produces both a human-readable report and a structured payload, **When** the comparison is saved, **Then** the structured decision points contain the same titles, verdicts, rationales, and per-ticket approaches that the report communicates for that run.
4. **Given** the comparison command instructions are used to generate a new comparison, **When** the AI produces the structured result, **Then** the instructions require decision-point-specific structured fields rather than only report-level summary fields.

### Edge Cases

- A newly generated comparison contains no decision points; the comparison remains viewable and clearly indicates that no decision points were saved for that run.
- A legacy comparison contains decision-point titles but not decision-point-specific rationale or participant approaches; the current fallback behavior remains in place for those missing fields.
- A comparison includes fewer per-ticket approach summaries than participating tickets for one decision point; the saved record must not invent missing ticket approaches and must surface only the data that was actually produced for that decision point.
- Two decision points have similar themes but different winners; each point must remain independently distinguishable by its own title and rationale.
- A project contains both regenerated and historical comparisons for the same ticket set; users can still open both, with each record reflecting the fidelity available when it was saved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST persist a distinct structured record for each decision point included in a newly generated comparison.
- **FR-002**: Each saved decision point MUST preserve its own title, verdict summary, rationale, and ordered per-ticket approach descriptions for that specific comparison choice.
- **FR-003**: The system MUST NOT populate newly saved decision points by copying global comparison recommendation fields into every decision point when decision-point-specific content exists in the comparison analysis.
- **FR-004**: The comparison dialog MUST display each decision point using the decision-point-specific structured fields saved for that item when those fields are available.
- **FR-005**: The comparison dialog MUST continue using the current fallback behavior for existing comparisons that do not include decision-point-specific structured fields.
- **FR-006**: A newly saved comparison MUST preserve the same number of decision points in the structured comparison data as were produced for that comparison run.
- **FR-007**: For each newly saved decision point, the structured comparison data MUST preserve the participant approach summary for every ticket that the comparison analysis explicitly described for that decision.
- **FR-008**: The saved structured decision points and the human-readable comparison report for the same comparison run MUST remain materially consistent in title, verdict, rationale, and per-ticket approach content.
- **FR-009**: The comparison generation instructions MUST require structured decision-point output for new comparisons so the saved record can capture decision-specific details.
- **FR-010**: If a new comparison run lacks usable structured decision-point content for a specific item, the system MUST avoid fabricating distinct details for that item and MUST preserve only the data actually produced for that comparison.
- **FR-011**: The feature MUST not require migration or regeneration of existing comparison records in order to keep historical comparisons viewable.

### Key Entities *(include if feature involves data)*

- **Decision Point Evaluation**: A saved comparison artifact representing one implementation choice, including the decision title, verdict summary, rationale, and participant-specific approach summaries for that choice.
- **Participant Approach Summary**: The description of how one compared ticket addressed a specific decision point, scoped to that decision point rather than to the overall comparison.
- **Comparison Analysis Payload**: The structured result saved for a comparison run, including the ordered collection of decision point evaluations alongside the broader comparison outcome.
- **Legacy Comparison Record**: A previously saved comparison that does not contain the newer decision-point-specific fields and therefore relies on fallback display behavior.

### Assumptions

- The AI comparison report already produces distinct decision-point content that is sufficiently specific to reuse in the structured comparison data.
- Historical comparison records will remain in mixed states for some time, so the product must support both enriched and legacy decision-point formats.
- Users value fidelity to the original comparison analysis more than normalization of wording across the dialog and the markdown report.

### Dependencies

- The comparison generation flow continues to produce a human-readable report and a structured comparison result for each successful comparison run.
- The comparison dialog continues to read persisted structured comparison data and can branch between enriched and fallback display behavior based on what was saved.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of newly generated comparisons with multiple decision points display unique title, verdict, rationale, and per-ticket approach content for each saved decision point.
- **SC-002**: In regression testing, 100% of pre-existing comparison records remain viewable and continue to render decision points using the current fallback behavior when enriched fields are unavailable.
- **SC-003**: For newly generated comparisons, the number of decision points shown in the comparison dialog matches the number produced in the saved comparison analysis for 100% of tested runs.
- **SC-004**: Reviewers can identify the distinct winner or preferred approach for each decision point in under 30 seconds when inspecting a comparison with at least three decision points.
- **SC-005**: For newly generated comparisons, validation finds no cases where a decision point incorrectly repeats the overall comparison rationale or recommendation in place of decision-specific content when distinct content was available.
