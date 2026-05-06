# Process: PairCalibrationOnOutcome

**Feature**: AIB-744
**Spec source**: spec.md §"Internal Processes" → PairAnalysisWithOutcome
**Trigger**: Outcome-capture completion (in-process chain after `captureOutcomeOnShip` resolves)

In-process pairing chained after `captureOutcomeOnShip` in `lib/tickets/transition.ts`. No new GitHub workflow, no event emitter, no polling — see `research.md` D1 for the full alternative analysis.

---

## Trigger surface

The pairing is invoked from `lib/tickets/transition.ts`, immediately after the existing `captureOutcomeOnShip` resolves. The existing fire-and-forget pattern (`research.md` P2) is preserved by wrapping both calls in a single async IIFE.

**Insertion point** — replace the existing block in `lib/tickets/transition.ts:355-364` with:

```ts
if (targetStage === Stage.SHIP) {
  void (async () => {
    try {
      const captureResult = await captureOutcomeOnShip({
        ticketId: updatedTicket.id,
        projectId: updatedTicket.projectId,
        workflowType: updatedTicket.workflowType,
        shippedAt: updatedTicket.updatedAt,
      });
      if (captureResult.status === 'created' || captureResult.status === 'duplicate') {
        await pairCalibrationOnOutcome({
          ticketId: updatedTicket.id,
          projectId: updatedTicket.projectId,
        });
      }
    } catch (err) {
      console.error('[ship-post-commit] unhandled', {
        ticketId: updatedTicket.id,
        err,
      });
    }
  })();
}
```

**Why fire-and-forget**: Per FR-002 + FR-012, calibration must NOT block, delay, or alter the SHIP transition or the AIB-742 capture flow. The caller's response is unchanged. If the Vercel function ends before pairing completes, no row is written for this transition — that ticket is silently excluded from drift metrics (FR-019), which is the spec's documented failure mode.

**Why chain only on `created` or `duplicate`**: `captureOutcomeOnShip` returns `failed` only when the ticket exists but the project does not (`lib/outcomes/capture.ts:236-241`). In that case there is no outcome row to pair, and the pairing must short-circuit.

---

## Inputs

| Input | Source | Notes |
|---|---|---|
| `ticketId` | `updatedTicket.id` | Required; the calibration row is keyed 1:1 on this |
| `projectId` | `updatedTicket.projectId` | Denormalised onto the calibration row |

The pairing function reads everything else from the database:
- The just-written `TicketOutcome` row (by `ticketId`)
- The latest `TicketAnalysis` row with `status='success'` for the ticket
- The ticket's `workflowType` (passed in via the outcome row's denormalised field)

---

## Phases

### Phase 1: Idempotency check

```ts
const existing = await prisma.analysisCalibration.findUnique({ where: { ticketId } });
if (existing) {
  // Already paired — no work, no error. Mirrors lib/outcomes/capture.ts:190-199.
  return { status: 'duplicate' };
}
```

If a row exists, return early. No write attempted. This makes the entire chain safe to invoke multiple times for the same ticket (e.g., if a future backfill chains here).

### Phase 2: Fetch the paired outcome

```ts
const outcome = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
if (!outcome) {
  // Race or dependency violation — capture said `created`/`duplicate` but the row is gone.
  // This should be impossible under normal flow; log and exit cleanly.
  console.warn('[calibration] outcome missing at pair time', { ticketId });
  return { status: 'no_outcome' };
}
```

The outcome row carries `frictionFree`, `qualityScore`, `totalCostUsd`, `workflowType`, `partial`, `partialReason` — all the actuals the pairing needs.

### Phase 3: Fetch the latest success analysis

```ts
const analysis = await prisma.ticketAnalysis.findFirst({
  where: { ticketId, status: 'success' },
  orderBy: { createdAt: 'desc' },
  select: { id: true, output: true, createdAt: true },
});
if (!analysis) {
  // FR-004: no success analysis ⇒ no calibration row.
  // The ticket still counts in adoption via the dashboard query (it has rows of any status).
  return { status: 'no_success_analysis' };
}
```

Per FR-003 + the spec's auto-resolved decision, only `success` analyses are eligible. `cold_start`, `failed`, and `running` rows are skipped. The `orderBy createdAt desc` plus the existing `@@index([ticketId, createdAt(sort: Desc)])` (`prisma/schema.prisma:815`) gives a single-row index seek.

### Phase 4: Parse the predicted output

```ts
import { AnalysisOutputSchema } from '@/lib/analysis/output-schema';

const parsed = AnalysisOutputSchema.safeParse(analysis.output);
if (!parsed.success) {
  // FR-009 reviewer note: "calibration should fail loudly if those fields are missing
  // rather than silently coercing to zero."
  console.error('[calibration] invalid analysis output', {
    ticketId,
    analysisId: analysis.id,
    issues: parsed.error.issues,
  });
  return { status: 'invalid_analysis_output' };
}
const predicted = parsed.data;
```

The Zod schema from AIB-743 (`lib/analysis/output-schema.ts:70-80`) is reused — calibration does not duplicate the prediction shape contract. Failure at this step logs and returns; no row is written.

### Phase 5: Compute friction pairing

```ts
const frictionPredictedClean = predicted.frictionRisk === 'low';
const frictionActualFree = outcome.frictionFree;
const frictionCell =
  frictionPredictedClean && frictionActualFree   ? 'TP' :
  !frictionPredictedClean && !frictionActualFree ? 'TN' :
  frictionPredictedClean && !frictionActualFree  ? 'FP' :
  /* !frictionPredictedClean && frictionActualFree */ 'FN';
```

Friction pairing is **always** computable — even on partial outcomes, AIB-742 populates `frictionFree` whenever `qualityScore` is known. If quality is unknown on a partial outcome, `frictionFree` is `false` per AIB-742's contract, which produces a defensible TN/FN classification (the row is honest about predicting clean vs friction even when the actual quality couldn't be measured). The spec's partial-row policy (FR-011) treats friction as one of the "available telemetry" signals.

### Phase 6: Compute quality pairing

```ts
let qualityVerdict: 'hit' | 'miss' | 'n_a';
if (outcome.qualityScore === null) {
  qualityVerdict = 'n_a';
} else if (
  outcome.qualityScore >= predicted.qualityGateRange.lower &&
  outcome.qualityScore <= predicted.qualityGateRange.upper
) {
  qualityVerdict = 'hit';
} else {
  qualityVerdict = 'miss';
}
```

Inclusive bounds (per spec auto-resolved decision). QUICK tickets and verify-without-score tickets land in `n_a` regardless of partial.

### Phase 7: Compute cost pairing

```ts
const summedLower = predicted.costRange.baselineLowerUsd + predicted.costRange.marginalFrictionLowerUsd;
const summedUpper = predicted.costRange.baselineUpperUsd + predicted.costRange.marginalFrictionUpperUsd;

let costVerdict: 'hit' | 'miss' | 'n_a';
if (outcome.totalCostUsd === null) {
  costVerdict = 'n_a';
} else if (outcome.totalCostUsd >= summedLower && outcome.totalCostUsd <= summedUpper) {
  costVerdict = 'hit';
} else {
  costVerdict = 'miss';
}
```

Summed range matches the user-facing "expected cost" line (per spec auto-resolved decision). Decomposed components (baseline lower/upper, marginal lower/upper) are persisted alongside for future drill-down (FR-009).

### Phase 8: Compute recommendation pairing

```ts
const recommendationMatched = predicted.recommendation.choice === outcome.workflowType;
const recommendationFrictionAligned =
  (predicted.recommendation.choice === 'QUICK' && outcome.frictionFree) ||
  (predicted.recommendation.choice === 'FULL' && !outcome.frictionFree);
```

Two booleans, both stored. Per spec, both axes are reported separately on the dashboard.

> **CLEAN edge case**: `outcome.workflowType` may be `CLEAN` (per `prisma/schema.prisma:687`'s `WorkflowType` enum, retained for historical data). `recommendationMatched` is `false` in that case (no `predicted.choice === 'CLEAN'` is reachable; AIB-743 only emits `QUICK` or `FULL`). This is correct — a `CLEAN` actual could not have matched any predicted recommendation.

### Phase 9: Persist

```ts
await persistCalibration({
  ticketId,
  projectId,
  analysisId: analysis.id,
  outcomeId: outcome.id,
  ruleSetVersion: CALIBRATION_RULE_SET_VERSION,
  shippedAt: outcome.shippedAt,

  frictionPredictedRating: predicted.frictionRisk,
  frictionPredictedClean,
  frictionActualFree,
  frictionCell,

  qualityPredictedLower: predicted.qualityGateRange.lower,
  qualityPredictedUpper: predicted.qualityGateRange.upper,
  qualityActual: outcome.qualityScore,
  qualityVerdict,

  costPredictedBaselineLowerUsd: predicted.costRange.baselineLowerUsd,
  costPredictedBaselineUpperUsd: predicted.costRange.baselineUpperUsd,
  costPredictedMarginalLowerUsd: predicted.costRange.marginalFrictionLowerUsd,
  costPredictedMarginalUpperUsd: predicted.costRange.marginalFrictionUpperUsd,
  costPredictedSummedLowerUsd: summedLower,
  costPredictedSummedUpperUsd: summedUpper,
  costActualUsd: outcome.totalCostUsd,
  costVerdict,

  recommendationPredicted: predicted.recommendation.choice,
  recommendationConfidence: predicted.recommendation.confidence,
  workflowActual: outcome.workflowType,
  recommendationMatched,
  recommendationFrictionAligned,

  partial: outcome.partial,
  partialReason: outcome.partialReason as PartialReason | null,
});
```

`persistCalibration` validates the row against the Zod superRefine guards (`data-model.md` §"Validation invariants") and calls `prisma.analysisCalibration.create({ data })` wrapped in a P2002-aware try/catch (P1 in `research.md`). On `P2002` (concurrent pairing won the race) → return `{ created: false, reason: 'duplicate' }`.

### Output

Exactly one immutable `AnalysisCalibration` row, queryable by the dashboard within the polling cadence (15s) of pairing completion. End-to-end SHIP → pairing latency target: under 5 minutes (SC-001), driven by the AIB-742 capture latency + a few hundred milliseconds for the pairing's pure DB joins.

---

## Error behaviour

| Scenario | Outcome | Logged? |
|---|---|---|
| Calibration row already exists for ticket | Return early (Phase 1); no write | No |
| Outcome row missing at pair time (race / impossible state) | Log warn `[calibration] outcome missing at pair time`; return cleanly | Yes |
| No `success` analysis for ticket | Return cleanly; no row written; ticket excluded from drift | No (this is a documented spec outcome, not an error) |
| Latest analysis exists but `output` doesn't match `AnalysisOutputSchema` | Log error `[calibration] invalid analysis output`; return cleanly | Yes |
| Zod superRefine fails on persist | Throw — caught by the chain's outer try/catch in `transition.ts`; logged as `[ship-post-commit] unhandled` | Yes |
| `prisma.analysisCalibration.create` throws (transient DB error) | Throw — caught by the chain's outer try/catch; logged. No row written; SHIP and capture unaffected (FR-019) | Yes |
| Race with retry: P2002 on `ticketId` | Treated as `duplicate`; no error surfaced | No |

**No bounded-retry loop is implemented in v1.** The spec mentions "bounded retries on transient infrastructure errors" — that requirement applies to the bounded-retry pattern AIB-742 already uses for its GitHub fetches. For the in-process pairing the only failure surface is Prisma; Vercel's serverless function lifecycle does not benefit from explicit retries (a re-tried call would land on a different worker with no shared state). Bounded retries become relevant only if a future change moves the pairing to a separate workflow — at which point the retry strategy will be designed explicitly. Documented as a known scope decision.

---

## Observability

- Each phase logs to `console` via `console.log('[calibration] phase=N ticketId=M durationMs=…')` matching the format from `lib/outcomes/capture.ts:42-47`. Includes `analysisId` and `outcomeId` after Phases 2–3.
- A successful pair logs `[calibration] success ticketId=M analysisId=A outcomeId=O`.
- Failures log `[calibration] failed ticketId=M phase=N reason=…`.
- The dashboard read path is independent of these logs — operators reading observability dashboards see capture and pairing as two separate spans on the same ticket lifecycle.

---

## Tests this satisfies

| User story / requirement | Test file |
|---|---|
| US2 acceptance scenarios 1–4 (pairing, immutability, no-success-analysis) | `tests/integration/calibration/pair-on-outcome.test.ts`, `multi-analysis.test.ts`, `no-success-analysis.test.ts`, `immutability.test.ts` |
| US3 (latest analysis paired) | `tests/integration/calibration/multi-analysis.test.ts` |
| US4 (cold-start excluded; partial outcome handled) | `tests/integration/calibration/cold-start.test.ts`, `partial-outcome.test.ts` |
| FR-005 (immutability) | `tests/integration/calibration/immutability.test.ts` |
| FR-019 (capture/SHIP unaffected by pairing failures) | EXTEND `tests/integration/ticket-transition.test.ts` |
| FR-007 / FR-008 / FR-009 / FR-010 (pairing field semantics) | Covered by `tests/unit/calibration/derive.test.ts` (pure functions) + the integration tests above |
| Edge cases: actual qualityScore on upper bound, null cost, CLEAN actual workflow type | `tests/integration/calibration/pair-on-outcome.test.ts` parameterised cases |
