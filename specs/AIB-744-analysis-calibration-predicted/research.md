# Research: AIB-744 Analysis Calibration — Predicted vs Actual + Drift Dashboard

**Branch**: `AIB-744-analysis-calibration-predicted` · **Date**: 2026-04-30
**Spec**: `specs/AIB-744-analysis-calibration-predicted/spec.md`

This document resolves Phase 0 unknowns, inventories existing files we will extend or imitate, and extracts the patterns the new code must follow. The spec's `Auto-Resolved Decisions` section already records every business-rule decision (binary friction class, inclusive quality bounds, summed cost range, dual recommendation axes, partial-row handling). The decisions below are the remaining **technical** choices that the spec deliberately deferred to PLAN.

---

## D1. Pairing trigger — chain from `lib/tickets/transition.ts` after `captureOutcomeOnShip` resolves

**Decision**: The calibration pairing is fired in-process from the same SHIP-transition hook that owns outcome capture, sequenced **after** `captureOutcomeOnShip` resolves (status `created` or `duplicate`). No new GitHub workflow is introduced; no event emitter or polling layer is added.

**Rationale**:
- Spec §"Auto-Resolved Decisions" pins pairing to **outcome-capture completion**, not the raw SHIP transition. Chaining from `transition.ts:355–364` (after the existing `void captureOutcomeOnShip(...)` call) is the smallest possible change that satisfies that contract — the outcome row is guaranteed to exist when the pairing runs.
- The pairing is a pure DB join (no LLM, no cross-repo I/O, no Octokit calls). Running it in-process matches AIB-742's own choice to keep capture in-process when the work is bounded and side-effect-free.
- Fire-and-forget at the same level (a sibling `void` block) keeps calibration failures decoupled from outcome capture and from SHIP itself (FR-012, FR-019).
- The outcome's `partial`/`partialReason` fields are already on the row when capture returns, so the pairing reads them via a single `findUnique` and applies the spec's partial-row policy without any retry against AIB-742's flow.

**Alternatives considered**:
- *Modify `lib/outcomes/capture.ts` to call the pairing at the end of Phase 10*. Rejected: spec FR-020 says calibration must not regress AIB-742 outcome capture; the cleanest way to honour that is to keep the pairing a strict downstream consumer rather than a co-tenant inside the capture module.
- *New GitHub Actions workflow (similar to `inbox-analysis.yml`)*. Rejected: zero LLM calls, zero filesystem checkouts, zero secrets the app doesn't already hold. The cost (cold start, dispatch latency, observability surface) buys nothing.
- *Event emitter / Postgres `LISTEN`*. Rejected: the platform has no precedent for either. Introducing one for this single consumer would be over-engineering against the constitution's "don't add abstractions beyond what the task requires" rule.
- *Polling-based pairing job*. Rejected: spec wants "within minutes" SLO end-to-end. A polling daemon would either run too often (waste) or too rarely (miss SLO).

**How to apply**: Insert a sibling fire-and-forget chain right after `void captureOutcomeOnShip(...).catch(...)` in `lib/tickets/transition.ts`. Wrap the whole thing in a small async IIFE so the calibration only runs when `captureOutcomeOnShip` resolved with `status: 'created' | 'duplicate'` (i.e. the outcome row exists).

---

## D2. Calibration row shape — single dedicated `AnalysisCalibration` table, 1:1 with Ticket

**Decision**: Add one new Prisma model, `AnalysisCalibration`, with `@@unique([ticketId])`. FK to `TicketAnalysis` (the paired success row) and FK to `TicketOutcome` (the paired outcome row). All paired fields stored explicitly on the row, not derived on read.

**Rationale**:
- Spec auto-resolved decision: "Storage is a dedicated append-only `AnalysisCalibration` table, one row per ticket". The 1:1 keying to ticket enforces "latest-success analysis paired against actual" at the schema level.
- Storing the paired booleans (e.g. `frictionTpFpFnTn`, `qualityVerdict`, `costVerdict`, `recommendationMatched`, `recommendationFrictionAligned`) explicitly on the row protects audit integrity if the binarisation rule ever changes — historical rows preserve the rule-set version that produced them.
- The dashboard query reduces to a simple `findMany({ where: { projectId }, orderBy: { shippedAt: 'desc' }, take: 30 })`. No ETL, no recomputation.

**Alternatives considered**:
- *Compute deltas at read time from `TicketAnalysis.output` joined with `TicketOutcome`*. Rejected: would couple the dashboard to live versions of the binarisation rules, which the spec explicitly forbids ("immutability matches the snapshot philosophy of AIB-742"). A future change to "low risk = predicted clean" must not retroactively alter historical drift numbers.
- *Reuse `TicketOutcome` with extra columns*. Rejected: spec FR-020 forbids edits to AIB-742's table, and pairing fields don't belong to "outcome" semantically.
- *Add a `calibration` JSON column to `TicketAnalysis`*. Rejected: makes querying by project (the dominant access pattern) require a JSON path query and prevents proper indexing.

**How to apply**: New model in `prisma/schema.prisma` next to `TicketAnalysis` (line 819), back-pointers added to `Ticket` and `Project` models. Migration generated via `bunx prisma migrate dev --name add_analysis_calibration`.

---

## D3. Confusion-matrix cell encoding — single enum on the row, plus 4 derived booleans for SQL aggregation

**Decision**: Persist the friction confusion cell as a single enum-like string column `frictionCell` ∈ `{ TP | TN | FP | FN }`, plus the predicted-3-class enum (`low | medium | high`) and the binarised "predicted clean" boolean. The dashboard SQL computes counts via `COUNT(*) FILTER (WHERE frictionCell = 'TP')` style aggregations.

**Rationale**:
- The cell is mutually exclusive — exactly one of TP/TN/FP/FN holds per row. A single enum is the canonical encoding and avoids the four-boolean redundancy (which would also need a CHECK constraint to ensure exactly one is true).
- Storing the 3-class predicted rating alongside (per spec) costs a few bytes and unlocks medium-vs-high drill-downs without a backfill.
- Postgres `COUNT(*) FILTER (WHERE …)` is the standard idiom for confusion-matrix aggregation; it reads cleanly in `lib/calibration/queries.ts` and is index-friendly when paired with `(projectId, shippedAt DESC)`.

**Alternatives considered**:
- *Four boolean columns (`frictionTp`, `frictionFp`, `frictionFn`, `frictionTn`)*. Rejected: redundant and error-prone (need a CHECK constraint).
- *Single integer cell index 0..3*. Rejected: less self-documenting than the enum string and not portable to future reporting (the labels matter).

**How to apply**: Use `String @db.VarChar(2)` with a Zod-validated enum at the boundary (matching how `partialReason` is handled on `TicketOutcome`). The constant `FrictionCell` enum lives in `lib/calibration/types.ts`.

---

## D4. Quality and cost verdicts — same 3-bucket enum (`hit | miss | n_a`), persisted explicitly

**Decision**: Persist `qualityVerdict` and `costVerdict` as `String @db.VarChar(4)` with values `hit | miss | n_a`. Persist the predicted bounds (lower, upper for quality; baselineLower/Upper, marginalLower/Upper for cost) and the actual values (nullable) verbatim so the verdict can be re-checked or re-binned later if the rule-set version moves.

**Rationale**:
- Spec auto-resolved decisions explicitly call for `n/a` as a third bucket distinct from miss, with the QUICK case as the reason quality goes `n/a` and "every job had null costUsd" as the reason cost goes `n/a`.
- Persisting the predicted decomposed cost components (per FR-009) lets a future drill-down split baseline-only hit rate from marginal-only hit rate without re-deriving from analysis rows.
- The verdict columns are tiny strings; the dashboard's distribution chart maps them 1:1 to the three render buckets.

**Alternatives considered**:
- *Boolean `hit` plus boolean `nA`*. Rejected: same redundancy issue as D3 and harder to read.
- *Numeric verdict (1=hit, 0=miss, -1=n_a)*. Rejected: non-self-documenting and obscures the spec's terminology.

**How to apply**: Two columns per signal — `qualityVerdict` and `costVerdict`. The Zod enum (`'hit' | 'miss' | 'n_a'`) is validated on insert; mismatched verdicts vs underlying values fail the row's superRefine guard.

---

## D5. Recommendation axes — two independent booleans, derived at write time

**Decision**: Persist `recommendationMatched: Boolean` and `recommendationFrictionAligned: Boolean` directly on the row. Compute both at pairing time:
- `recommendationMatched = (predicted.choice === ticket.workflowType)`
- `recommendationFrictionAligned = (predicted.choice === 'QUICK' && outcome.frictionFree) || (predicted.choice === 'FULL' && !outcome.frictionFree)`

Also persist the predicted choice (`QUICK | FULL`), the predicted confidence (`low | medium | high`), and the actual `workflowType` so the row remains auditable independent of the boolean encodings.

**Rationale**:
- Spec auto-resolved decision explicitly calls for both axes as separate booleans on the row.
- Persisting raw inputs alongside the derived booleans matches the snapshot philosophy and is consistent with how AIB-742 persists both raw aggregates and derived `frictionFree`.

**How to apply**: Compute in `lib/calibration/pair.ts` Phase 4 (recommendation pairing). Validated via Zod superRefine: both booleans must be derivable from the persisted inputs (no inconsistent rows).

---

## D6. Adoption denominator — derive feature-availability moment from "first `TicketAnalysis` row in project"

**Decision**: The "moment the analysis feature became available on the project" is the `MIN(createdAt)` across `TicketAnalysis` rows for that project. The adoption denominator is `COUNT(DISTINCT Ticket.id)` where `Ticket.createdAt >= MIN(analysis.createdAt)` for the project. Numerator is `COUNT(DISTINCT Ticket.id)` joining tickets that have ≥1 `TicketAnalysis` row of any status.

**Rationale**:
- Spec assumption: "absent a per-project marker, fall back to 'tickets created on or after the first analysis row in the project'." There is no per-project marker today (verified — `Project` model has no `analysisFeatureEnabledAt` column or equivalent), so the fallback governs.
- Computed live from existing rows; no schema change required to support the counter.
- The query is bounded by project (small N) and projected to two integers — well under the dashboard's tens-of-milliseconds budget.

**Alternatives considered**:
- *Add a `Project.analysisFeatureAvailableAt` column*. Rejected: requires a backfill across all projects and gives no measurable benefit over the derived approach.
- *Use a global feature-flag date for all projects*. Rejected: mis-charges projects that exist but were never analysed (denominator would always include their entire history).

**How to apply**: Helper `computeAdoption(projectId)` in `lib/calibration/queries.ts` runs two `Prisma.aggregate` queries in parallel: (a) `MIN(createdAt)` from `TicketAnalysis` for project, (b) using that timestamp, count distinct tickets via subquery. Returns `{ analyzed, sinceFeatureAvailable, ratio }`.

---

## D7. Window denominator — fixed 30 most recent, with caption listing the larger denominator

**Decision**: The dashboard query is `prisma.analysisCalibration.findMany({ where: { projectId }, orderBy: { shippedAt: 'desc' }, take: 30 })`. The caption shows "30 of N" where `N = prisma.analysisCalibration.count({ where: { projectId } })`. Below 30, the dashboard renders the available rows with a "still warming up: X of 30" indicator.

**Rationale**:
- Spec auto-resolved decision: 30-row default with explicit indicator when the underlying dataset is larger.
- Two cheap queries (`findMany take: 30` + `count`) keep the read path simple. A windowed average / streaming aggregate is unnecessary at this scale.

**How to apply**: `getCalibrationDashboard(projectId)` in `lib/calibration/queries.ts` runs both queries in parallel and returns a typed `CalibrationDashboardData` payload.

---

## D8. Partial-outcome handling — pairing creates a row with `n_a` verdicts where required

**Decision**: When the paired outcome has `partial = true`, the pairing **still creates a calibration row**. Cells whose computation depends on fields the outcome could not capture are set to `n_a`; cells that survive a partial outcome (cost — telemetry-derived; friction confusion cell — derived from `frictionFree`, which AIB-742 always computes when quality and friction-job count are known) are populated normally. The row carries `partial: true` and a `partialReason` snapshot copied from the outcome.

**Rationale**:
- Matches AIB-742's stance ("partial outcomes still get a row").
- Preserves the count integrity required by SC-011.
- The dashboard's headline rates exclude `n_a` cells per-signal, so partial rows do not pollute the rates.

**Special-case discovery**:
- `frictionFree` on a partial outcome is **only** populated when `qualityScore` is known (per `lib/outcomes/capture.ts:120-123` `persistPartial`). If quality is unknown on a partial, `frictionFree` is `false` by default — but that's a derivation from the AIB-742 contract, not something we can re-derive. The pairing trusts what the outcome says.
- `partialReason` enum on `TicketOutcome` is `String @db.VarChar(40)` (not a Prisma enum) — we mirror it as `String? @db.VarChar(40)` on the calibration row for snapshotting.

**How to apply**: Calibration row's `qualityVerdict = 'n_a'` whenever `outcome.qualityScore === null`, regardless of partial. `costVerdict = 'n_a'` whenever `outcome.totalCostUsd === null`. The friction cell is always computable from `outcome.frictionFree`. The recommendation axes are always computable from `predicted.choice` and `ticket.workflowType` / `outcome.frictionFree`.

---

## D9. Cascade behaviour and immutability invariant

**Decision**: `AnalysisCalibration` cascades on Ticket delete and Project delete. The row is write-once: there is no API surface that mutates it, and tests assert the absence of any `update` / `upsert` call against the model.

**Rationale**:
- AIB-742 cascades `TicketOutcome` on Ticket/Project delete (`lib/outcomes/persist.ts`, schema lines 734–735). AIB-744 follows the same convention so `MIN(shippedAt) … 30 latest` queries don't return rows whose source ticket was hard-deleted.
- Spec FR-005: "System MUST NOT modify a calibration row after it is written. The row is an immutable snapshot."
- Spec auto-resolved decision: "Re-pairing on outcome change is never performed."

**How to apply**: `onDelete: Cascade` on the FKs to Ticket and Project (and the FKs to TicketAnalysis and TicketOutcome — those cascade transitively via Ticket). An integration test asserts a duplicate pairing attempt is a no-op (P2002 → silent skip, mirroring `persistOutcome`'s pattern).

---

## D10. Backfill — explicitly out of scope

**Decision**: No backfill workflow ships with AIB-744. Existing shipped tickets that lack a calibration row remain so. The dashboard's "30 of N" caption naturally reflects the smaller dataset for projects in the early days.

**Rationale**:
- Spec scope is "every analyzed-then-shipped ticket" going forward; nothing in the spec mandates retroactive coverage.
- AIB-743 only shipped recently (migration `20260428070442_add_ticket_analysis`), so the historical population of "analysed AND shipped" tickets is small.
- A backfill could be added later via a script that mirrors AIB-742's `scripts/backfill-outcomes.ts` pattern. Documenting that path here is enough.

**How to apply**: Document in plan.md as "out of scope". Open a follow-up ticket if dogfood reveals a need.

---

## Existing Files

This inventory is mandatory per the planning rubric and drives the "extend, don't duplicate" rule. Every file the implementation will modify or pattern after is listed with its exact path and one-line role.

### Schema & migrations

| Path | Role | Action |
|---|---|---|
| `prisma/schema.prisma` (lines 681–741) | `TicketOutcome` model — source of `frictionFree`, `qualityScore`, `totalCostUsd`, `partial`, `partialReason`, `workflowType` | Read only — no edits |
| `prisma/schema.prisma` (lines 767–819) | `TicketAnalysis` model + status enum — source of predicted friction risk, quality range, cost range, recommendation in `output` JSON | Read only — no edits |
| `prisma/schema.prisma` (Ticket model, lines 165–206; Project model, lines 102–139) | Back-pointers we will extend with `calibration: AnalysisCalibration?` and `calibrations: AnalysisCalibration[]` | Modify (add back-pointer relations only — same idiom as AIB-742 added `outcome: TicketOutcome?`) |
| `prisma/schema.prisma` (after line 819) | Insertion point for the new `AnalysisCalibration` model | New |
| `prisma/migrations/<timestamp>_add_analysis_calibration/migration.sql` | Generated by `bunx prisma migrate dev --name add_analysis_calibration` | New |

### Trigger surface

| Path | Role | Action |
|---|---|---|
| `lib/tickets/transition.ts` (line 355–364, the SHIP block) | Fire-and-forget post-commit hook — current site of `void captureOutcomeOnShip(...)` | Modify — add a chained pairing call after capture resolves |
| `lib/outcomes/capture.ts` | `captureOutcomeOnShip(input): Promise<CaptureResult>` — returns `status: 'created' \| 'duplicate' \| 'failed'` | Read only — calibration consumes the result |
| `lib/outcomes/persist.ts` | `persistOutcome` pattern — Zod superRefine validation + P2002 idempotency | Pattern to follow (same shape for `persistCalibration`) |

### New module — `lib/calibration/`

| Path | Role |
|---|---|
| `lib/calibration/types.ts` | `RULE_SET_VERSION` constant, `FrictionCell` / `Verdict` enums, `PairedCalibration` interface, `CalibrationDashboardData` interface |
| `lib/calibration/pair.ts` | `pairCalibrationOnOutcome({ ticketId, projectId }): Promise<PairResult>` — orchestrator (idempotency check → fetch outcome → fetch latest success analysis → compute → persist) |
| `lib/calibration/persist.ts` | Zod-validated `prisma.analysisCalibration.create()` with P2002 idempotency guard, mirroring `lib/outcomes/persist.ts` |
| `lib/calibration/derive.ts` | Pure functions: `binariseFriction`, `classifyFrictionCell`, `quantifyQualityVerdict`, `quantifyCostVerdict`, `computeRecommendationAxes` |
| `lib/calibration/queries.ts` | `getCalibrationDashboard(projectId): Promise<CalibrationDashboardData>` (30-row window + adoption counter) |
| `lib/calibration/serialize.ts` | Row → API DTO (also re-shapes the confusion matrix for the dashboard) |

### API surface

| Path | Role | Action |
|---|---|---|
| `app/api/projects/[projectId]/calibration/route.ts` | `GET` — owner-only dashboard endpoint, `verifyProjectOwnership` gate | New |
| `lib/db/auth-helpers.ts` (lines 97–120) | `verifyProjectOwnership` — already exists, reused | Read only |

### Page & UI

| Path | Role | Action |
|---|---|---|
| `app/projects/[projectId]/calibration/page.tsx` | Owner-only Server Component (mirrors `analytics/page.tsx`) — calls `verifyProjectOwnership` (or relies on the API gate via `notFound()` on error), seeds the dashboard initial data | New |
| `components/calibration/calibration-dashboard.tsx` | TanStack Query container, 15s polling, owns the four sub-components | New |
| `components/calibration/confusion-matrix-table.tsx` | Labelled HTML `<table>` with TP/TN/FP/FN cell counts and percentages, plus precision/recall on the "low risk" class | New |
| `components/calibration/verdict-distribution-chart.tsx` | Reusable bar chart + tabular fallback for hit/miss/n_a buckets — used for both quality and cost | New |
| `components/calibration/recommendation-panel.tsx` | Two stat cards: `recommendationMatched` rate and `recommendationFrictionAligned` rate, plus tabular fallback | New |
| `components/calibration/adoption-counter.tsx` | "X of Y tickets analysed since feature available, ratio Z%" stat card | New |
| `app/lib/query-keys.ts` | TanStack `queryKeys` object — extend with `calibration.dashboard(projectId)` | Modify |
| `app/lib/hooks/queries/useCalibration.ts` | Hook with 15 s `refetchInterval`, mirroring `useTicketAnalysis` / analytics dashboard | New |

### Reference files (pattern-only, not modified)

| Path | Role |
|---|---|
| `app/api/projects/[projectId]/analytics/route.ts` | Reference for `verifyProjectAccess` flow + Zod query parsing + error envelope. Calibration mirrors the structure but with `verifyProjectOwnership`. |
| `app/projects/[projectId]/analytics/page.tsx` | Reference for the Server-Component → Client-Component initial-data hand-off |
| `components/analytics/analytics-dashboard.tsx` (lines 86–101) | Reference for `useQuery + refetchInterval: 15000 + initialData` pattern |
| `components/analytics/overview-cards.tsx` | Reference for shadcn/ui Card composition + accessible KPI display |
| `lib/analytics/queries.ts` | Reference for read-only Prisma aggregation helpers |

### Tests

| Path | Role | Action |
|---|---|---|
| `tests/unit/calibration/derive.test.ts` | Unit tests for `binariseFriction`, `classifyFrictionCell`, `quantifyQualityVerdict`, `quantifyCostVerdict`, `computeRecommendationAxes` (all pure) | New |
| `tests/integration/calibration/pair-on-outcome.test.ts` | End-to-end: seed ticket+success analysis+outcome, drive `pairCalibrationOnOutcome`, assert exactly one calibration row with all paired fields populated | New |
| `tests/integration/calibration/multi-analysis.test.ts` | Asserts US3 — two success analyses, only the latest is paired; older row unmodified | New |
| `tests/integration/calibration/cold-start.test.ts` | Asserts US4 — latest analysis is `cold_start`, no calibration row written, ticket counts in adoption | New |
| `tests/integration/calibration/partial-outcome.test.ts` | Asserts FR-011 / SC-011 — partial outcome, calibration row written with `n_a` verdicts where required | New |
| `tests/integration/calibration/no-success-analysis.test.ts` | Asserts FR-004 / Edge case 1 — only failed analyses, no calibration row | New |
| `tests/integration/calibration/immutability.test.ts` | Asserts FR-005 — second pairing call against the same ticket is a no-op (P2002) | New |
| `tests/integration/calibration/api-calibration.test.ts` | Asserts US6 / SC-007 — owner gets 200 with payload, member gets 404 not-found, non-member gets 404 not-found (indistinguishable) | New |
| `tests/integration/calibration/dashboard-window.test.ts` | Asserts FR-015 — 30-row window with "30 of N" caption when N > 30; "still warming up" indicator when N < 30 | New |
| `tests/integration/calibration/adoption-counter.test.ts` | Asserts FR-016 / SC-008 — counter denominator excludes pre-feature tickets; numerator includes failed/cold-start | New |
| `tests/integration/ticket-transition.test.ts` (existing) | EXTEND — assert SHIP transition is unaffected by calibration failures (mirrors the existing AIB-742 capture-failure assertion) | Modify |
| `tests/unit/components/calibration-dashboard.test.tsx` | Component test — render the dashboard with a fixture payload, assert each panel and the tabular fallback | New |
| `tests/unit/components/confusion-matrix-table.test.tsx` | Component test — assert role="table", correct cell labels, precision/recall computation | New |

**Test type rationale** (constitution §III decision tree):
- `derive.ts` is pure → unit.
- The pairing flow involves Prisma reads/writes → integration.
- The owner-only API gate, dashboard window, and adoption counter all involve DB queries → integration.
- The dashboard React components are interaction-light (no forms / mutations) but render server-supplied data with a tabular fallback → unit RTL component tests.
- No E2E required: no new browser-only flow (no drag-drop, no OAuth, no viewport-sensitive behaviour). The Server Component page is exercised by the API integration test plus the component tests.

---

## Patterns to Follow

The implementation reuses three established patterns from the codebase. Every reference below cites a real file:line so the implementing agent can read the source rather than guess.

### P1. Persist with Zod superRefine + P2002 idempotency guard

**Reference**: `lib/outcomes/persist.ts:24-152`.

The existing pattern validates the entire row via a Zod schema with cross-field invariants enforced in `superRefine`, calls `prisma.<model>.create({ data })` inside a try/catch, and treats `P2002` (unique constraint) as `{ created: false, reason: 'duplicate' }` rather than an error. This is the exact contract the calibration pairing needs:
- Zod superRefine asserts the cross-field invariants AIB-744 introduces:
  - Friction: `frictionCell` is consistent with `frictionPredictedClean` and `frictionActualFree` (e.g., `TP ⇔ predictedClean=true && actualFree=true`).
  - Quality: `qualityVerdict='n_a' ⇔ qualityActual===null`; `'hit' ⇔ qualityActual ∈ [predictedLower, predictedUpper]`; otherwise `'miss'`.
  - Cost: same shape against the summed range.
  - Recommendation: `recommendationMatched` and `recommendationFrictionAligned` are derivable from the persisted inputs.
  - Partial: `partial=true ⇔ partialReason !== null`, mirroring AIB-742 (`lib/outcomes/persist.ts:87-100`).
- P2002 idempotency lets the chained pairing be safely retried by callers (e.g. backfill in a future ticket) without duplicate-row errors.

### P2. Fire-and-forget post-commit hook with isolated catch

**Reference**: `lib/tickets/transition.ts:355-364` (and the documenting workflow spec at `specs/AIB-742-capture-ticket-outcomes/workflows/capture-on-ship.md` lines 8–32).

The existing SHIP hook is a single `void capture(...).catch(...)` that:
- Never blocks the response — captured by `void`.
- Never lets capture errors propagate — catch-and-log only.
- Is idempotent under retry — capture's own Phase 1 idempotency check guards against duplicate writes.

The calibration call **must** preserve all three properties:
- `void` chain: pairing latency is invisible to SHIP callers.
- `.catch((err) => console.error('[calibration] unhandled', { ticketId, err }))` — logged but never thrown.
- Pairing's own Phase 1 is `prisma.analysisCalibration.findUnique({ where: { ticketId } })` → return early if a row exists.

The chain order is: capture first, then pairing. Implementation sketch (in `transition.ts`):

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

This wraps the existing capture call in an async IIFE — the only behavioural change for capture is that its `.catch` is now the outer `try/catch`. Capture's failure modes are preserved (it returns `'failed'` in lieu of throwing for the cases it knows how to handle); the outer catch is the safety net for unexpected throws (process termination, OOM, etc.).

### P3. Owner-only API + page with a generic 404 on the failure case

**Reference**: `lib/db/auth-helpers.ts:97-120` (the `verifyProjectOwnership` helper) and `app/api/projects/[projectId]/analytics/route.ts:36-50` (the error envelope mapping).

The existing helper throws `Error('Project not found')` for both "project doesn't exist" and "user is not the owner" — exactly the indistinguishable response the spec requires (FR-013, SC-007). The API route maps that to a 404. The calibration route mirrors this exactly:

```ts
try {
  await verifyProjectOwnership(projectId);
  // ... happy path
} catch (error) {
  if (error instanceof Error && error.message === 'Project not found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 }); // collapsed to indistinguishable response
  }
  // ...
}
```

The Server Component page mirrors `app/projects/[projectId]/analytics/page.tsx:60-68` — call `notFound()` on the same error message so the rendered HTML is the platform's standard 404 (no leak that the dashboard exists for the project).

### P4. Read-only dashboard with TanStack Query 15s polling

**Reference**: `components/analytics/analytics-dashboard.tsx:86-101`.

The reference dashboard uses:
- Server Component page that calls the query helper synchronously to seed `initialData`.
- Client Component `'use client'` dashboard that wraps the data in `useQuery({ initialData, refetchInterval: 15000, staleTime: 10000 })`.
- `queryKeys.<feature>.<descriptor>(...)` generated from `app/lib/query-keys.ts`.

The calibration dashboard mirrors this 1:1: same hook shape, same polling cadence (FR-017), same initial-data hand-off, same error/empty states.

### P5. Test fixture pattern — seed via Prisma, mock auth-helpers, reuse `[e2e]` projects

**Reference**: `tests/integration/outcomes/outcome-capture-on-ship.test.ts` and `tests/integration/analytics/analytics-route.test.ts` (already discovered in Phase 0 inventory).

Both files use `getTestContext()` (or equivalent) for an isolated test project + user + Prisma client, seed dependencies via direct Prisma calls, mock auth-helpers with `vi.mock('@/lib/db/auth-helpers', ...)` for API tests, and clean up in `afterEach`. The calibration integration tests follow the same shape — no new fixture machinery is introduced.

---

## Open questions resolved against the spec

The spec's "Reviewer Notes" raised a few items that PLAN must resolve before implementation begins:

1. **AIB-742 emits a stable signal that pairing can listen to or poll** — D1 confirms: capture is invoked synchronously from `transition.ts:355` and returns a `CaptureResult` with `status: 'created' | 'duplicate' | 'failed'`. Calibration chains off this without inventing a new signal.
2. **`@@unique([ticketId])` is the right cardinality** — D2 confirms: spec says re-ships are out of scope, so 1:1 keying is correct.
3. **`actualWorkflowType` is from `Ticket.workflowType`** — confirmed by reading `Ticket` schema (lines 165–206) and `lib/outcomes/capture.ts:31` which already pulls it as `Ticket['workflowType']`.
4. **Predicted cost components are explicit lower/upper for both baseline and marginal** — confirmed via `lib/analysis/output-schema.ts:47-60` (`CostRangeSchema` exposes all four bounds).
5. **`partialReason` snapshot column** — D8 confirms: mirrored as `String? @db.VarChar(40)` matching `TicketOutcome.partialReason`.
6. **"Feature first available" derivation** — D6 confirms: `MIN(TicketAnalysis.createdAt)` per project.
7. **Polling cadence matches analytics** — confirmed via `components/analytics/analytics-dashboard.tsx:99` (`refetchInterval: 15000`).
8. **Tabular fallback convention** — confirmed via the analytics components (e.g., `dimension-comparison-chart.tsx`) which render a chart + a `<table>` fallback. The calibration distributions follow the same shape.

No `NEEDS CLARIFICATION` items remain.
