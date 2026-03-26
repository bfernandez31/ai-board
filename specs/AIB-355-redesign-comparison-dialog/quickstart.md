# Quickstart: Comparison Mission Control Dashboard Implementation

**Feature Branch**: `AIB-355-redesign-comparison-dialog`
**Date**: 2026-03-26

## Implementation Sequence

### 1. Restructure the Dialog Layout

Update the comparison viewer to absorb generated/source metadata into the winner hero, preserve the current dialog shell and history sidebar behavior, and define the new section order.

Primary files:
- `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-viewer.tsx`
- `/home/runner/work/ai-board/ai-board/target/components/comparison/types.ts`

### 2. Redesign Ranking Into Hero + Participant Cards

Promote the winner into a dominant hero treatment and render the remaining participants as ranked, visually distinct summary cards with score-band cues and rationale.

Primary files:
- `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-ranking.tsx`
- `/home/runner/work/ai-board/ai-board/target/components/comparison/types.ts`

### 3. Merge Headline and Detailed Metrics

Replace the split implementation/operational sections with headline metric summaries plus one unified comparison matrix that preserves the quality-score popover and sticky label behavior.

Primary files:
- `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-metrics-grid.tsx`
- `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-operational-metrics.tsx`
- `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-quality-popover.tsx`

### 4. Strengthen Compliance and Decision Scanning

Add explicit verdict/status cues, default-open the first decision, and ensure compliance notes and missing states are understandable without hover-only access.

Primary files:
- `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-compliance-grid.tsx`
- `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-decision-points.tsx`

### 5. Protect the Existing API Contract

Keep the current comparison routes unchanged while extending integration coverage for the fields the redesigned dashboard depends on.

Primary files:
- `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/check/route.ts`
- `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts`
- `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/[comparisonId]/route.ts`
- `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/`

### 6. Add Focused Test Coverage

Extend existing component and integration suites instead of creating redundant test files.

Suggested test targets:
- `/home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-dashboard-sections.test.tsx`
- `/home/runner/work/ai-board/ai-board/target/tests/unit/components/`
- `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-dashboard-api.test.ts`

## Validation Commands

```bash
cd /home/runner/work/ai-board/ai-board/target
bun run type-check
bun run lint
bun run test:unit
bun run test:integration
```

## Expected Outcome

After implementation:
- Users can identify the winner immediately from the hero section.
- All 2-6 participants remain visible in one comparison session.
- Metrics, compliance, and decisions are scannable without manual cross-referencing.
- Existing comparison APIs and dialog shell behavior remain intact.
