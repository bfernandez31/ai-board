# Quickstart: AIB-338 Enrich Comparison Dialog

**Feature Branch**: `AIB-338-enrich-comparison-dialog`  
**Date**: 2026-03-21

## Overview

This quickstart validates that the ticket comparison dialog now shows ranking context, aggregated operational metrics, and in-place quality details without regressing the existing comparison sections.

## Prerequisites

```bash
cd /home/runner/work/ai-board/ai-board/target
bun install
```

Start the app when running manual or browser validation:

```bash
bun run dev
```

## Implementation Outline

1. Extend the comparison detail read path in `lib/comparison/` to aggregate participant jobs and normalize operational/quality data.
2. Extend `lib/types/comparison.ts` and `hooks/use-comparisons.ts` to carry the enriched payload.
3. Add an `Operational Metrics` UI section and enrich ranking cards with workflow type, agent, and quality threshold context.
4. Add an inline quality-detail tray inside the comparison dialog.
5. Verify unit, component, integration, and targeted E2E coverage.

## Testing Strategy

Apply the project decision tree per behavior area and extend existing tests before creating new ones.

| Behavior | Test Type | Target |
|----------|-----------|--------|
| Aggregation helpers, dominant-model logic, pending/unavailable classification, best-value flags | Unit | `tests/unit/comparison/` |
| Ranking card context badges and Operational Metrics interactions | Component | `tests/unit/components/` |
| Enriched comparison detail API payload | Integration | `tests/integration/comparisons/` |
| Horizontal scrolling/readability on desktop and mobile | E2E | `tests/e2e/` |

Recommended test file plan:

- Extend `tests/integration/comparisons/comparison-detail-route.test.ts`
- Extend `tests/unit/components/comparison-ranking.test.tsx`
- Add `tests/unit/components/comparison-operational-metrics.test.tsx`
- Add or extend `tests/unit/comparison/comparison-detail-aggregation.test.ts`
- Add one focused Playwright scenario for the comparison dialog overflow behavior

## Manual Validation

### 1. Ranking context

Open a saved comparison containing mixed workflow types and agents.

Expected:
- Each ranking card shows the workflow type badge
- Agent label appears when available
- Quality score and threshold label appear when a quality summary exists

### 2. Operational metrics section order

Open the same comparison dialog.

Expected:
- `Implementation Metrics` remains first
- `Operational Metrics` appears immediately after it
- `Decision Points` and `Compliance Grid` still render afterward

### 3. Aggregated values and best flags

Use a comparison where tickets have different job totals.

Expected:
- Rows exist for total tokens, input tokens, output tokens, duration, cost, job count, and quality
- Best-value badges appear on the lowest visible token/duration/cost/job-count values and highest visible quality value
- All tied best values are highlighted

### 4. Pending versus unavailable

Use one ticket with in-progress jobs and one ticket with no relevant telemetry.

Expected:
- In-progress aggregates display `Pending`
- Missing data that will never exist displays `Not available`
- Neither case is shown as `0` or as a best value

### 5. Model attribution

Use one ticket with a clear dominant model and one ticket with mixed model usage.

Expected:
- Dominant ticket shows a single model label
- Mixed-history ticket shows `Multiple models`

### 6. Quality detail tray

Use a FULL workflow ticket with a completed verify job containing quality details.

Expected:
- Clicking the quality value opens an inline detail tray
- The tray shows overall score, threshold label, and all available dimension scores with weights
- Tickets without eligible details do not appear interactive

### 7. Responsive overflow

Validate the dialog at desktop width and a mobile viewport.

Expected:
- Native horizontal scrolling keeps ticket columns readable
- The metric label column remains visible while participant columns scroll
- Long ticket titles and badges do not collapse the table into unreadable content

## Automated Validation

Run fast checks first:

```bash
bun run test:unit -- comparison
bun run test:unit -- comparison-ranking
```

Run integration coverage for the API payload:

```bash
bun run test:integration -- comparison-detail-route
```

Run browser coverage only for the responsive/scroll behavior:

```bash
bun run test:e2e -- comparison
```

Run repository gates before commit:

```bash
bun run type-check
bun run lint
```

## Success Checklist

- Aggregated operational values match all participant jobs
- Ranking cards show workflow type, agent, and quality threshold context
- Pending and unavailable states are visually distinct from numeric values
- Quality details open only for eligible FULL workflow tickets
- Comparison dialog remains readable from two to six tickets on desktop and mobile
