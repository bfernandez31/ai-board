# Internal Process: Analysis–Outcome Pairing

**Branch**: `AIB-773-copy-of-analysis`

## Overview

The pairing process pairs an analysis (prediction) with an outcome (actual) into an `AnalysisOutcomePairing` record once a ticket reaches SHIP and both inputs are available. It is the foundation of the drift dashboard.

## Triggers

The pairing function `pairAnalysisWithOutcome(ticketId)` is invoked from two places:

### Trigger 1 — Inline at SHIP transition (primary path)

**Location**: `lib/tickets/transition.ts`, extending the existing SHIP block at lines 355–364.

**Modified envelope**:

```typescript
if (targetStage === Stage.SHIP) {
  void captureOutcomeOnShip({ ticketId, projectId, workflowType, shippedAt })
    .then(() => pairAnalysisWithOutcome(updatedTicket.id))
    .catch((err) => {
      console.error('[drift-pairing] unhandled', { ticketId: updatedTicket.id, err });
    });
}
```

- Fire-and-forget. Errors logged with `[drift-pairing]` tag. SHIP transition NEVER blocks on or surfaces pairing failures.
- The single `.catch` covers both the capture and pairing chains (matches existing pattern).

### Trigger 2 — Nightly sweep for late outcomes

**Location**: `app/api/maintenance/sweep-unpaired-pairings/route.ts` (NEW), invoked by `.github/workflows/nightly-pairing-sweep.yml` (NEW) at 01:45 UTC.

The sweep finds rows where `pendingOutcome=true AND unpairedReason IS NULL`, retries `pairAnalysisWithOutcome(ticketId)`. If `now - shippedAt > 24h` and the outcome is still missing, it sets `pendingOutcome=false, unpairedReason='outcome_missing_24h'`.

## Inputs

- `ticketId: number` — the only required input. The function reads everything else from the database.

## Phases

The function executes the following phases in order, with structured `[drift-pairing]` logging per phase:

### Phase 1 — Look up most recent analysis

```sql
SELECT * FROM TicketAnalysis
WHERE ticketId = ? AND status = 'success'
ORDER BY createdAt DESC, id DESC
LIMIT 1
```

- If no analysis row → log `phase=1 result=no_analysis ticketId=…`, **exit successfully** (FR-004 — no error, no record).
- If analysis exists but `output` is null or unparseable → continue to Phase 2 with `analysisOutputUnparseable=true` and mark all dimensions incomparable.

### Phase 2 — Look up outcome

```sql
SELECT * FROM TicketOutcome WHERE ticketId = ? LIMIT 1
```

- If no outcome row → upsert pairing with `pendingOutcome=true, unpairedReason=null`, exit. (Sweep will retry.)
- If outcome row exists but `partial=true` AND `partial_reason IN ('no_branch_reference','merge_not_found','repository_unreachable','fetch_failed_after_retry','no_jobs')` → still pair; cost/quality dimensions may be incomparable depending on which fields are null on the partial outcome.

### Phase 3 — Parse analysis output

```typescript
const parsed = AnalysisOutputSchema.safeParse(analysis.output);
```

- If `parsed.success === false` → set `frictionIncomparable = costIncomparable = qualityIncomparable = recommendationIncomparable = true`, log `phase=3 result=output_unparseable`, persist a row with `unpairedReason='output_unparseable'`, and exit.
- If success → use `parsed.data` for delta computation.

### Phase 4 — Compute deltas

Pure function, no DB access:

```typescript
function computeDeltas(prediction: AnalysisOutput, outcome: TicketOutcome): PairingDeltas {
  // Friction (binarized per spec auto-resolved decision)
  const predictedLow = prediction.frictionRisk === 'low';
  const actualLow = outcome.frictionFree === true;
  const frictionMatch = predictedLow === actualLow;
  const frictionEmerged = !outcome.frictionFree;

  // Cost: envelope = [baselineLowerUsd, marginalFrictionUpperUsd] (research decision)
  const costLower = prediction.costRange.baselineLowerUsd;
  const costUpper = prediction.costRange.marginalFrictionUpperUsd;
  const actualCost = outcome.totalCostUsd;
  const costIncomparable = actualCost === null;
  const costInRange = !costIncomparable && actualCost >= costLower && actualCost <= costUpper;
  const costMissDirection = costIncomparable
    ? null
    : (actualCost < costLower ? 'under' : actualCost > costUpper ? 'over' : null);

  // Quality
  const qLower = prediction.qualityGateRange.lower;
  const qUpper = prediction.qualityGateRange.upper;
  const actualQ = outcome.qualityScore;
  const qualityIncomparable = actualQ === null;
  const qualityInRange = !qualityIncomparable && actualQ >= qLower && actualQ <= qUpper;
  const qualityMissDirection = qualityIncomparable
    ? null
    : (actualQ < qLower ? 'under' : actualQ > qUpper ? 'over' : null);

  // Workflow recommendation (CLEAN actuals are legacy — treat as a mismatch unless predicted matches)
  const predictedRec = prediction.recommendation.choice;
  const actualWf = outcome.workflowType;
  const recommendationMatch = predictedRec === actualWf;

  return {
    predictedFriction: prediction.frictionRisk,
    actualFrictionFree: outcome.frictionFree,
    frictionPredictedLow: predictedLow,
    frictionMatch,
    frictionEmerged,
    frictionIncomparable: false,
    predictedCostLowerUsd: costLower,
    predictedCostUpperUsd: costUpper,
    predictedBaselineUpperUsd: prediction.costRange.baselineUpperUsd,
    actualCostUsd: actualCost,
    costInRange: costIncomparable ? null : costInRange,
    costMissDirection,
    costIncomparable,
    predictedQualityLower: qLower,
    predictedQualityUpper: qUpper,
    actualQualityScore: actualQ,
    qualityInRange: qualityIncomparable ? null : qualityInRange,
    qualityMissDirection,
    qualityIncomparable,
    predictedRecommendation: predictedRec,
    actualWorkflowType: actualWf,
    recommendationMatch,
    recommendationIncomparable: false,
  };
}
```

This pure function is fully unit-testable in `tests/unit/lib/drift/compute-pairing.test.ts`.

### Phase 5 — Upsert and mark countedInDrift flags

Inside a single Prisma transaction:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Upsert pairing (idempotent on ticketId per FR-006)
  await tx.analysisOutcomePairing.upsert({
    where: { ticketId },
    create: { ticketId, projectId, analysisId: analysis.id, outcomeId: outcome.id, shippedAt, pendingOutcome: false, unpairedReason: null, ...deltas },
    update: { analysisId: analysis.id, outcomeId: outcome.id, pendingOutcome: false, unpairedReason: null, ...deltas },
  });

  // 2. Set countedInDrift on chosen analysis to true; all others for the same ticket to false.
  await tx.ticketAnalysis.updateMany({
    where: { ticketId, NOT: { id: analysis.id } },
    data: { countedInDrift: false },
  });
  await tx.ticketAnalysis.update({
    where: { id: analysis.id },
    data: { countedInDrift: true },
  });
});
```

Log: `phase=5 ticketId=… analysisId=… outcomeId=… durationMs=…`.

## Output

- An `AnalysisOutcomePairing` row keyed by `ticketId` (created or updated).
- The chosen `TicketAnalysis.countedInDrift = true`; all other analyses for the ticket `false`.
- For tickets that never paired within 24h: a row with `pendingOutcome=false, unpairedReason='outcome_missing_24h'`.

## Error Behaviour

- Phase failures inside the function are caught and logged; they do NOT propagate to the SHIP transition.
- Database transaction failures are logged and surfaced as a thrown error to the caller (the fire-and-forget envelope's `.catch`). The next sweep retry will attempt pairing again as long as `pendingOutcome=true` is still set or no row exists.
- The pairing function MUST NOT log analysis output content (PII risk minimal but no need); it logs only ids, counts, and durations.

## Idempotency Properties

- **Re-firing on duplicate SHIP**: `upsert(where: { ticketId })` makes this safe (FR-006).
- **Re-firing during sweep**: same upsert path; deltas are recomputed but the row is idempotently updated.
- **Race between trigger 1 and trigger 2**: the upsert is atomic at the DB level; whichever transaction commits second wins, but both compute the same deltas from the same inputs, so the row is consistent.

## File Layout (NEW)

```
lib/drift/
├── pair.ts             # pairAnalysisWithOutcome(ticketId) entry point
├── compute-deltas.ts   # pure function: prediction × outcome → deltas
├── persist.ts          # transactional upsert + countedInDrift flag flip
├── sweep.ts            # sweep entry point (called by maintenance API)
├── queries.ts          # getDriftData(projectId, filters) for dashboard
└── types.ts            # PairingDeltas, DriftData, DriftFilters
```
