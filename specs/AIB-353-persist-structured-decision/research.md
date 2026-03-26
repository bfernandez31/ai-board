# Research: AIB-353 — Persist Structured Decision Points

## Research Task 1: Existing DecisionPoint Data Model

**Decision**: The Prisma `DecisionPointEvaluation` model already supports per-point structured data.

**Rationale**: The existing schema (`prisma/schema.prisma:408-424`) already has:
- `title` (String) — decision point title
- `verdictTicketId` (Int?, nullable) — per-point winner, supports ties
- `verdictSummary` (String) — per-point verdict description
- `rationale` (String) — per-point reasoning
- `participantApproaches` (Json) — per-ticket approach descriptions
- `displayOrder` (Int) — ordering

No schema migration is needed. The gap is entirely in the **data pipeline** — the AI command doesn't produce structured data, the Zod schema doesn't validate it, and `buildDecisionPoints()` derives data from `matchingRequirements` with a global winner.

**Alternatives considered**: Adding a new Prisma model was unnecessary since `DecisionPointEvaluation` already has the right shape.

---

## Research Task 2: Current buildDecisionPoints() Behavior

**Decision**: Modify `buildDecisionPoints()` to prefer structured `report.decisionPoints` over derived data.

**Rationale**: Current behavior (`lib/comparison/comparison-record.ts:143-169`):
- Derives titles from `report.alignment.matchingRequirements` (generic labels like "API endpoints")
- Sets `verdictTicketId` to the **global winner** for ALL decision points (same winner repeated)
- Sets `verdictSummary` to the global `report.recommendation` (repeated for all)
- Sets `rationale` to the global `report.summary` (repeated for all)
- Sets `participantApproaches` to generic `"X files changed"` summaries

This produces low-quality, repetitive decision points. The fix: when `report.decisionPoints` is present and non-empty, use it directly; otherwise fall back to current behavior.

**Alternatives considered**: Removing the fallback entirely — rejected for backward compatibility (FR-003).

---

## Research Task 3: Zod Schema Extension Pattern

**Decision**: Add an optional `decisionPoints` array to `serializedComparisonReportSchema`.

**Rationale**: The Zod schema (`lib/comparison/comparison-payload.ts:60-80`) validates incoming JSON. Adding an optional field with `.optional().default([])` preserves backward compatibility — payloads without the field pass validation and default to empty array, triggering the fallback path.

**Alternatives considered**: Making it required — rejected because it would break in-flight comparisons and the AI command template update may not be deployed simultaneously.

---

## Research Task 4: AI Command Template Structure

**Decision**: Add `decisionPoints` field specification to Step 10.5 of the compare command.

**Rationale**: The compare command (`.claude-plugin/commands/ai-board.compare.md:331-416`) already instructs the AI to analyze decision points in Step 7 and render them in the markdown report in Step 10. Step 10.5 generates the JSON payload but currently omits structured decision point data. Adding a `decisionPoints` array schema to Step 10.5 — with `title`, `verdictTicketKey`, `verdictSummary`, `rationale`, and `approaches` — ensures the AI populates the field using data it already generates.

**Alternatives considered**: Auto-extracting decision points from markdown — rejected as fragile and error-prone.

---

## Research Task 5: Ticket Key Validation (FR-008)

**Decision**: Skip invalid ticket key references rather than failing.

**Rationale**: The persistence layer should validate that `ticketKey` values in decision point approaches exist in the comparison's `participantTicketKeys` list. Invalid references (e.g., hallucinated ticket keys) should be silently skipped to prevent the entire comparison from failing due to one bad AI output.

**Alternatives considered**: Failing the entire persistence — rejected because partial data is better than no data.

---

## Research Task 6: Null Verdict Handling (FR-007)

**Decision**: Allow `verdictTicketKey` to be `null` in the JSON payload for tie decisions.

**Rationale**: The Prisma schema already supports `verdictTicketId Int?` (nullable). The Zod schema should accept `null` for `verdictTicketKey`. The UI component (`components/comparison/comparison-decision-points.tsx`) already handles nullable `verdictTicketId` gracefully.

**Alternatives considered**: Using a sentinel value like "TIE" — rejected as the nullable pattern is already established.
