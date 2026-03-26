# Quickstart: Persist Structured Decision Points in Comparison Data

## Goal

Save decision-point-specific comparison content for new comparisons while keeping historical comparison records readable without migration.

## Implementation Order

1. Update `/home/runner/work/ai-board/ai-board/target/lib/types/comparison.ts`
   - Add `ComparisonReportDecisionPoint` and `ComparisonReportDecisionPointApproach`.
   - Extend `ComparisonReport` and `SerializedComparisonReport` with ordered `decisionPoints`.

2. Update `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-payload.ts`
   - Add Zod schemas for `decisionPoints`.
   - Validate ticket-key references and reject duplicate per-decision participant keys.
   - Preserve array order for persistence/display.

3. Update `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-generator.ts`
   - Extend the report-construction path so the generator can accept structured decision points.
   - Render a markdown decision-points section from `report.decisionPoints`.
   - Keep markdown and JSON artifact content materially aligned.

4. Update `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-record.ts`
   - Replace `buildDecisionPoints()` fallback synthesis for new records with direct mapping from `report.decisionPoints`.
   - Resolve `verdictTicketKey` and approach ticket keys to persisted IDs.
   - Persist only produced participant approaches for sparse decision points.
   - Keep legacy read-path normalization intact.

5. Update `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts`
   - Keep route validation aligned with the expanded payload contract.
   - Preserve existing authorization and idempotency behavior.

6. Extend tests
   - `/home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-payload.test.ts`
   - `/home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-record.test.ts`
   - `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-persistence.test.ts`
   - `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-detail-route.test.ts`
   - `/home/runner/work/ai-board/ai-board/target/tests/unit/components/markdown-table-rendering.test.tsx`

## Validation Flow

1. Run `bun run test:unit -- comparison-payload comparison-record`
2. Run `bun run test:integration -- comparisons`
3. Run `bun run type-check`
4. Run `bun run lint`

## Expected Outcomes

- New workflow POST payloads can carry ordered decision-point structure.
- New `DecisionPointEvaluation` rows contain distinct decision-specific verdicts, rationales, and per-ticket approach summaries.
- Historical comparisons still open successfully and keep their current fallback behavior.
- The markdown artifact and saved structured comparison data describe the same decision points for a run.
