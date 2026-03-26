# Research: Persist Structured Decision Points in Comparison Data

## Decision 1: Reuse `DecisionPointEvaluation`; do not add new database tables

**Decision**: Keep the current Prisma persistence model and populate existing `DecisionPointEvaluation` rows from structured comparison output instead of synthesized fallback fields.

**Rationale**:
- `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` already stores `title`, `verdictTicketId`, `verdictSummary`, `rationale`, `participantApproaches`, and `displayOrder`.
- The defect is in how `lib/comparison/comparison-record.ts` builds those rows for new comparisons, not in the relational model.
- Reusing the schema avoids unnecessary migrations and supports FR-011 backward compatibility.

**Alternatives considered**:
- Add a new decision-point table hierarchy: rejected because current storage is sufficient.
- Migrate historical rows to a richer schema: rejected because the spec explicitly forbids requiring migration or regeneration.

## Decision 2: Add structured `decisionPoints` to `ComparisonReport` and serialized persistence payloads

**Decision**: Extend `ComparisonReport` and `SerializedComparisonReport` with an ordered `decisionPoints` array that includes decision-specific verdict and per-ticket approach content.

**Rationale**:
- `/home/runner/work/ai-board/ai-board/target/lib/types/comparison.ts` currently has no decision-point structure on `ComparisonReport`.
- `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-payload.ts` validates the same omission, so the workflow POST cannot currently carry decision-specific content.
- Without this contract, persistence code is forced to invent decision points from report-level summary/recommendation fields.

**Alternatives considered**:
- Parse the markdown report back into structure during persistence: rejected because it is format-fragile and duplicates generation logic.
- Store decision points only in a sidecar JSON file and not in the workflow payload: rejected because the POST contract should be the authoritative persisted input.

## Decision 3: Make `report.decisionPoints` the single source for both markdown and persistence

**Decision**: Generate markdown decision sections and persisted `DecisionPointEvaluation` rows from the same ordered `report.decisionPoints` collection for each comparison run.

**Rationale**:
- FR-008 requires the structured payload and human-readable report to remain materially consistent.
- `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-generator.ts` currently renders summary, alignment, metrics, compliance, telemetry, warnings, and recommendation, but no structured decision-point section.
- Sharing one source prevents drift between the dialog and markdown artifact.

**Alternatives considered**:
- Continue treating markdown as richer and structure as a lossy summary: rejected because that is the current failure mode.
- Render decision points only in the UI and not in markdown: rejected because markdown remains a retained artifact of the same run.

## Decision 4: Preserve legacy fallback behavior only at read time

**Decision**: Historical comparisons keep using the currently saved `DecisionPointEvaluation` rows exactly as they exist today, while new comparisons stop generating fallback decision-point content from global report fields.

**Rationale**:
- `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-record.ts` currently normalizes whatever was saved and already tolerates partial or malformed `participantApproaches`.
- `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-decision-points.tsx` already supports an empty-state message when no decision points exist.
- This preserves readability for pre-feature records without changing current UI semantics.

**Alternatives considered**:
- Rewrite old records on read: rejected because it fabricates history and adds hidden complexity.
- Reject incomplete saved rows at read time: rejected because it would break historical comparisons.

## Decision 5: Do not fabricate missing per-ticket approach details for new comparisons

**Decision**: When the generator produces a decision point with incomplete participant approaches, persist only the approaches actually provided and keep the saved record honest to the source output.

**Rationale**:
- FR-010 explicitly prohibits inventing distinct details that were not produced.
- Existing persistence already supports JSON arrays of varying completeness in `participantApproaches`.
- This approach keeps new records faithful while allowing validation rules to reject only malformed structure, not legitimately sparse content.

**Alternatives considered**:
- Auto-fill missing tickets with generic summaries such as file-count metrics: rejected because that recreates the current defect.
- Reject the entire comparison when one decision point is sparse: rejected because the spec prefers preserving produced data over dropping the whole record.

## Decision 6: Extend existing comparison tests instead of creating parallel suites

**Decision**: Reuse current comparison test seams for payload validation, persistence mapping, detail-route assertions, and viewer rendering.

**Rationale**:
- Existing tests already cover workflow POST persistence, detail-route aggregation, comparison fixtures, and structured viewer rendering.
- Extending them keeps regression coverage close to the relevant subsystem and follows the repo rule to search existing tests first.

**Alternatives considered**:
- Add brand-new standalone suites for decision points: rejected because it would duplicate fixture setup and reduce signal.
