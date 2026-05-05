# Research: Analysis Calibration — Predicted vs Actual + Drift Dashboard

**Branch**: `AIB-773-copy-of-analysis` | **Date**: 2026-05-05 | **Spec**: `specs/AIB-773-copy-of-analysis/spec.md`

## Open Decisions (Resolved Here)

### Decision: Predicted cost range definition

The analysis output (`AnalysisOutput.costRange`, `lib/analysis/output-schema.ts:47-60`) carries four numbers: `baselineLowerUsd`, `baselineUpperUsd`, `marginalFrictionLowerUsd`, `marginalFrictionUpperUsd`. The actual outcome stores a single value (`TicketOutcome.totalCostUsd`, `prisma/schema.prisma:692`).

- **Decision**: Headline cost-range hit is computed against `[baselineLowerUsd, marginalFrictionUpperUsd]` — the widest envelope the analysis offered. The pairing record additionally stores `inBaselineRange` and `inMarginalRange` separately so future iterations can refine.
- **Rationale**: Spec describes a binary "in-range / out-of-range" panel; this is the envelope an honest reader would interpret as "the analysis covered this cost". Storing both sub-ranges preserves audit data without complicating the headline UI.
- **Alternatives considered**: Use baseline range only (rejected — too punitive on tickets where friction emerged and the prediction acknowledged it via the marginal band); compute two separate hit/miss panels (rejected — spec asks for one cost-range panel).

### Decision: Friction binarization mapping

Spec auto-resolved decision (line 10 of spec.md): `low` → positive class ("low risk"); `medium` and `high` → negative class ("not low risk"). Actual side: `TicketOutcome.frictionFree` boolean (`prisma/schema.prisma:726`) — `true` is the positive ("low risk") class.

- **Decision**: Confusion matrix labels:
  - **TP**: predicted `low`, actual `frictionFree=true`
  - **FN**: predicted `low`, actual `frictionFree=false`
  - **FP**: predicted `medium|high`, actual `frictionFree=true`
  - **TN**: predicted `medium|high`, actual `frictionFree=false`
- **Rationale**: Matches the spec's "first-shot-clean = positive low-risk match" reviewer note.

### Decision: Pairing trigger ordering

The outcome capture is fire-and-forget on SHIP (`lib/tickets/transition.ts:355-364`); pairing must run after both the analysis and the outcome are persisted.

- **Decision**: Two trigger paths converge on the same idempotent pairing function:
  1. **At SHIP**: After `captureOutcomeOnShip` resolves with `status: 'created'` (or `'duplicate'`), call `pairAnalysisWithOutcome(ticketId)`. The capture function already runs fire-and-forget; we extend its `.then` to chain pairing.
  2. **Late-outcome arrival**: A nightly sweep (`/api/maintenance/sweep-unpaired-pairings`) walks tickets that are SHIP, have an analysis, but no pairing row yet (or have a pairing row marked `pendingOutcome=true`); it retries pairing. After 24h since SHIP it marks the ticket `unpairedReason='outcome_missing_24h'` and excludes from drift.
- **Rationale**: The outcome capture pipeline already handles partial outcomes (`partial=true` rows persisted with `partialReason`). Pairing always re-checks if the outcome row exists and is non-partial enough to compute deltas. The sweep covers gaps where outcome capture fails permanently or runs significantly after SHIP. No new queue infrastructure introduced.
- **Alternatives considered**: BullMQ / job queue (rejected — no existing queue infrastructure; adds a new dependency); inline pairing inside `captureOutcomeOnShip` (rejected — couples two distinct domain concerns; pairing must also fire when outcome arrives via a *future* path, e.g., backfill).

### Decision: Drift counter denominator timing

Spec auto-resolved decision (lines 53–60): denominator is "tickets that *left* INBOX in the same project". Implementation: `prisma.ticket.count({ where: { projectId, stage: { not: 'INBOX' } } })`.

- **Decision**: Use a snapshot count at request time, not a pre-aggregated row.
- **Rationale**: Counts are bounded per project (typical projects under 10k tickets), Postgres index on `(projectId, stage)` makes this <10ms; no separate materialization needed for SC-002 (<2s p95).

### Decision: "Missing predicted dimension" handling

Spec FR-015 requires excluding incomparable dimensions from a panel's denominator. Older analyses pre-date the schema and have `output: null` or partial fields. The current `AnalysisOutputSchema` is `.strict()` and validates the full shape; partial output JSON is possible only for `cold_start` analyses (which use `ColdStartOutputSchema`, `lib/analysis/output-schema.ts:82-87`).

- **Decision**: Pairing computes per-dimension `incomparable` booleans. The pairing row carries `frictionIncomparable`, `costIncomparable`, `qualityIncomparable`, `recommendationIncomparable`. Dashboard query filters per-panel.
- **Rationale**: Simpler than a JOIN with a versioned analysis schema table; the pairing row becomes self-describing.

### Decision: Re-analysis after SHIP

Spec edge case: "A ticket is analysed after it has already been shipped". Such an analysis must be stored but never paired.

- **Decision**: Pairing locks `analysisId` at SHIP time. Subsequent analyses created after the pairing row exists are inserted with `countedInDrift=false` and never alter the pairing.
- **Rationale**: Idempotency on `ticketId` (FR-006) means no second pairing is created; the locked `analysisId` ensures the post-ship analysis cannot retroactively become the "most recent" used.

## Existing Files

This inventory was derived from a focused codebase scan. The plan MUST extend these files where indicated and create new files only where no existing file covers the responsibility.

### Domain: Analysis (predictions side)

| Path | Role | Action |
|------|------|--------|
| `prisma/schema.prisma` (`TicketAnalysis` lines 749–794) | Persistence model for analysis rows; `output` Json field stores `AnalysisOutput` | **Extend**: add `countedInDrift Boolean @default(false)` field |
| `lib/analysis/output-schema.ts` | Zod schema and types for `AnalysisOutput` (`frictionRisk`, `costRange`, `qualityGateRange`, `recommendation`) | **Reuse as-is**: parse `output` JSON via `AnalysisOutputSchema.safeParse` inside the pairing function |
| `lib/analysis/persist.ts` | `insertRunningAnalysis()` creates analysis records | **No change** |
| `lib/analysis/dispatch-analysis.ts` | Dispatches the inbox-analysis workflow | **No change** |

### Domain: Outcomes (actuals side)

| Path | Role | Action |
|------|------|--------|
| `prisma/schema.prisma` (`TicketOutcome` lines 680–740) | Persistence model for outcome rows | **No change** to schema; consumed via Prisma client |
| `lib/outcomes/types.ts` | `DerivedOutcome` interface; `RULE_SET_VERSION`, `QUALITY_THRESHOLD_FRICTION_FREE` | **Reuse**: types referenced by pairing module |
| `lib/outcomes/capture.ts` (`captureOutcomeOnShip`, lines 185–324) | Fire-and-forget orchestrator on SHIP | **Pattern reference** for fire-and-forget side effect; new pairing module mirrors phase logging and `try/catch` envelope |
| `lib/outcomes/persist.ts` (`persistOutcome`, lines 135–153) | Idempotent insert via try/catch on P2002 | **Pattern reference**: pairing module follows the same P2002-tolerant pattern |

### Domain: Stage transition

| Path | Role | Action |
|------|------|--------|
| `lib/tickets/transition.ts` (SHIP block lines 355–364) | Fires `captureOutcomeOnShip` on SHIP | **Extend**: chain `pairAnalysisWithOutcome` after capture resolves; both run fire-and-forget |
| `lib/tickets/transition.ts` (`rollbackToPlanWithReset`, lines 70–126) | Pattern reference for "DB mutation, then dispatch external side effect, propagate dispatch failure as `DISPATCH_FAILED_AFTER_MUTATION`" | **Pattern reference only** — pairing is intentionally non-blocking and does NOT propagate failure to the SHIP transition (similar to outcome capture) |

### Domain: Analytics dashboard

| Path | Role | Action |
|------|------|--------|
| `app/projects/[projectId]/analytics/page.tsx` | Top-level analytics route, calls `verifyProjectAccess` indirectly via `getProject` | **Pattern reference**: drift dashboard mirrors structure but uses `verifyProjectOwnership` (owner-only per FR-007) |
| `app/api/projects/[projectId]/analytics/route.ts` | Analytics API GET handler (Zod-validated query params) | **Pattern reference**: drift API mirrors structure |
| `lib/analytics/queries.ts` | `getAnalyticsData(projectId, filters)` aggregator | **Pattern reference**: drift queries follow same `getDriftData(projectId, filters)` shape |
| `lib/analytics/types.ts` | `AnalyticsData`, `AnalyticsFilters` shapes | **Pattern reference**: parallel `DriftData`, `DriftFilters` types in `lib/drift/types.ts` |
| `components/analytics/analytics-dashboard.tsx` | Client dashboard with TanStack Query 15s polling | **Pattern reference**: new `components/drift/drift-dashboard.tsx` mirrors polling pattern |
| `components/analytics/empty-state.tsx` | Empty-state component | **Reuse as-is**: imported by drift dashboard for zero-state |

### Domain: Authorization

| Path | Role | Action |
|------|------|--------|
| `lib/db/auth-helpers.ts` (`verifyProjectOwnership`, lines 97–120) | Owner-only project verification | **Reuse as-is**: drift API and page both call this (FR-007 — owner only) |

### Domain: Maintenance crons

| Path | Role | Action |
|------|------|--------|
| `.github/workflows/nightly-log-prune.yml` | Cron at 01:15 UTC, `curl POST` with `Bearer $WORKFLOW_API_TOKEN` | **Pattern reference**: new `nightly-pairing-sweep.yml` follows the exact same shape |
| `app/api/maintenance/prune-logs/route.ts` (referenced by the workflow above; verify path) | Maintenance API endpoint pattern | **Pattern reference**: new `app/api/maintenance/sweep-unpaired-pairings/route.ts` mirrors auth (Bearer token) and JSON response |

### Domain: Tests (extend, do not duplicate)

| Path | Existing coverage | Action |
|------|-------------------|--------|
| `tests/integration/analysis/trigger-analysis.test.ts` | POST/GET analysis API | **No change** — pairing has separate tests |
| `tests/integration/analysis/analysis-status.test.ts` | Analysis status transitions | **No change** |
| `tests/integration/outcomes/outcome-capture-on-ship.test.ts` | `captureOutcomeOnShip` end-to-end | **Extend**: add a test asserting `pairAnalysisWithOutcome` is invoked after capture |
| `tests/integration/outcomes/outcome-immutability.test.ts` | `TicketOutcome` immutability | **No change** |
| `tests/integration/outcomes/outcome-partial-paths.test.ts` | Partial-outcome paths | **No change** |
| `tests/integration/analytics/analytics-route.test.ts` | Analytics API contract | **Pattern reference**: new `tests/integration/drift/drift-route.test.ts` mirrors structure |
| `tests/unit/components/analytics-dashboard.test.tsx` | Dashboard rendering | **Pattern reference**: new `tests/unit/components/drift-dashboard.test.tsx` |

**New test files** (no existing file covers these responsibilities):
- `tests/unit/lib/drift/compute-pairing.test.ts` — pure-function unit tests for delta computation (friction binarization, cost-range hit, quality hit, workflow match) and incomparable-dimension flagging.
- `tests/integration/drift/pair-on-ship.test.ts` — pair lifecycle: ship with analysis + outcome → pair created; ship without analysis → no pair, no error; ship with analysis but late outcome → pair created on retry; >24h late → unpairedReason set.
- `tests/integration/drift/drift-route.test.ts` — owner-only access, panel data shape, cross-project isolation, empty-state.
- `tests/integration/drift/sweep-pairings.test.ts` — sweep endpoint flips `unpairedReason` correctly past 24h.
- `tests/unit/components/drift-dashboard.test.tsx` — RTL test for confusion matrix, cost panel, quality panel, usage panel rendering with text labels (FR-008, SC-005).

## Patterns to Follow

### Pattern 1 — Fire-and-forget side effect on stage transition (`lib/tickets/transition.ts:355-364`)

```typescript
if (targetStage === Stage.SHIP) {
  void captureOutcomeOnShip({ ticketId, projectId, workflowType, shippedAt })
    .catch((err) => { console.error('[outcome-capture] unhandled', { ticketId, err }); });
}
```

**Rule for pairing**: Same envelope. The pairing call MUST be `void`-prefixed and `.catch`-handled with a tagged log line; the SHIP transition MUST NOT block on, await, or surface pairing errors. Implement as `void captureOutcomeOnShip(...).then(() => pairAnalysisWithOutcome(ticketId)).catch(err => console.error('[drift-pairing] unhandled', { ticketId, err }))`.

### Pattern 2 — Idempotent persist with P2002 swallow (`lib/outcomes/persist.ts:144-152`)

```typescript
try {
  await prisma.ticketOutcome.create({ data });
  return { created: true };
} catch (err) {
  if (isP2002(err)) return { created: false, reason: 'duplicate' };
  throw err;
}
```

**Rule for pairing**: The pairing module MUST use `prisma.analysisOutcomePairing.upsert({ where: { ticketId }, create, update })` with a unique constraint on `ticketId` (FR-006 — idempotent on `ticketId`). The upsert must filter `undefined` values to respect TS `exactOptionalPropertyTypes` (cf. `lib/db/subscriptions.ts:31-57`).

### Pattern 3 — Phase logging with structured tag (`lib/outcomes/capture.ts:41-46`)

```typescript
function logPhase(ticketId: number, phase: number, durationMs: number, extra?: Record<string, unknown>): void {
  console.log(`[outcome-capture] phase=${phase} ticketId=${ticketId} durationMs=${durationMs}`, extra ?? {});
}
```

**Rule for pairing**: Use `[drift-pairing]` tag. Phases: 1=lookup-analysis, 2=lookup-outcome, 3=parse-output, 4=compute-deltas, 5=upsert. Same single-call envelope; no metric service.

### Pattern 4 — Authorization in API route (`app/api/projects/[projectId]/analytics/route.ts`)

The drift API at `app/api/projects/[projectId]/drift/route.ts` MUST call `verifyProjectOwnership(projectId, request)` (NOT `verifyProjectAccess`) to enforce FR-007. The 404-vs-403 handling MUST mirror existing routes (current code throws `Error('Project not found')` for both cases, which is acceptable — the spec's "deny as if did not exist" matches this).

### Pattern 5 — Maintenance cron + API (`.github/workflows/nightly-log-prune.yml`)

Schedule a new GitHub Actions cron that POSTs to `/api/maintenance/sweep-unpaired-pairings` with `Authorization: Bearer $WORKFLOW_API_TOKEN`. The endpoint runs the 24h sweep and returns `{ examined, paired, expired }`. Schedule offset from existing crons (`00:30` health, `01:15` log-prune) — propose `01:45 UTC`.

### Pattern 6 — TanStack Query 15s polling (`components/analytics/analytics-dashboard.tsx:94-100`)

```typescript
useQuery({
  queryKey: queryKeys.drift.data(projectId, filters),
  queryFn: () => fetchDrift(projectId, filters),
  initialData: shouldUseInitialData ? initialData : undefined,
  refetchInterval: 15000,
  staleTime: 10000,
});
```

**Rule for drift dashboard**: Same polling cadence and `staleTime`. `queryKeys.drift` added to `app/lib/query-keys.ts`.

## Best Practices Considered

- **Confusion matrix accessibility (FR-008, SC-005)**: shadcn/ui `<Table>` with explicit `<th scope="col">` and `<th scope="row">`; numeric cells include `aria-label="True positives: 12"`. No reliance on color tokens for semantic meaning — counts are typeset.
- **Recharts vs table**: All four panels are tabular per spec ("labelled table"). No Recharts charts in this dashboard. Spec explicitly avoids "color-only encoding".
- **Page route placement**: Drift dashboard placed at `/projects/[projectId]/analytics/drift` (sub-route of analytics) — this matches user mental model ("analysis drift section of analytics area" per User Story 1) and inherits the analytics layout.
