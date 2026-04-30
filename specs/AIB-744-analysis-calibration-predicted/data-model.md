# Data Model: AIB-744 Analysis Calibration

**Branch**: `AIB-744-analysis-calibration-predicted` · **Date**: 2026-04-30
**Spec**: `specs/AIB-744-analysis-calibration-predicted/spec.md`

One new Prisma model — `AnalysisCalibration` — plus two back-pointer relations on existing models (`Ticket.calibration`, `Project.calibrations`). No edits to `TicketAnalysis`, `TicketOutcome`, or any other existing column. All schema changes ship in one Prisma migration, generated via `bunx prisma migrate dev --name add_analysis_calibration`.

---

## Entity 1: `AnalysisCalibration`

**Purpose**: One immutable row per shipped+analyzed ticket, capturing the deltas between the latest successful `TicketAnalysis` row and the captured `TicketOutcome` row at outcome-capture time. Drives the project-owner-only drift dashboard.

**Cardinality**:
- 1:1 with `Ticket` (enforced via `@@unique([ticketId])`).
- many:1 with `Project` (denormalised for the project-scoped dashboard query).
- 1:1 with `TicketAnalysis` (FK to the paired success row; `@@unique([analysisId])` so the same analysis can never be paired twice — defensive belt against future re-pairing logic).
- 1:1 with `TicketOutcome` (FK to the paired outcome row; `@@unique([outcomeId])` for the same reason).

### Prisma model

```prisma
model AnalysisCalibration {
  id Int @id @default(autoincrement())

  // Identity & lookup
  ticketId   Int      @unique               // 1:1 — exactly one calibration row per ticket
  projectId  Int                            // denormalised — dominant access pattern is by project
  analysisId Int      @unique               // FK to the paired TicketAnalysis row (status='success')
  outcomeId  Int      @unique               // FK to the paired TicketOutcome row

  // Versioning & audit
  ruleSetVersion Int                        // CALIBRATION_RULE_SET_VERSION at write time
  capturedAt     DateTime @default(now())   // when this row was written
  shippedAt      DateTime                   // denormalised from outcome.shippedAt for ordering

  // Friction pairing
  // Predicted side: keep both the binarised flag (used by the headline confusion matrix)
  // and the original 3-class enum (so a future drill-down can split medium from high).
  frictionPredictedRating String  @db.VarChar(8)   // 'low' | 'medium' | 'high'
  frictionPredictedClean  Boolean                  // true iff frictionPredictedRating == 'low'
  // Actual side: from outcome.frictionFree.
  frictionActualFree      Boolean                  // mirrors outcome.frictionFree
  // Confusion-matrix cell (mutually exclusive — derived at write time, validated by superRefine).
  // Positive class = "predicted clean" / "actual frictionFree".
  frictionCell            String  @db.VarChar(2)   // 'TP' | 'TN' | 'FP' | 'FN'

  // Quality pairing
  qualityPredictedLower Int                    // 0..100, inclusive
  qualityPredictedUpper Int                    // 0..100, inclusive (lower <= upper)
  qualityActual         Int?                   // null = QUICK / no verify-with-score
  qualityVerdict        String  @db.VarChar(4) // 'hit' | 'miss' | 'n_a'

  // Cost pairing
  // Decomposed predicted components (per AIB-743's CostRangeSchema) — preserved for future drill-down.
  costPredictedBaselineLowerUsd Float
  costPredictedBaselineUpperUsd Float
  costPredictedMarginalLowerUsd Float
  costPredictedMarginalUpperUsd Float
  // Summed predicted range (matches the user-facing "expected cost" line) — denormalised for read path.
  costPredictedSummedLowerUsd   Float
  costPredictedSummedUpperUsd   Float
  costActualUsd                 Float?                  // null = every job had null costUsd
  costVerdict                   String  @db.VarChar(4)  // 'hit' | 'miss' | 'n_a'

  // Recommendation pairing
  recommendationPredicted       String  @db.VarChar(5)  // 'QUICK' | 'FULL'
  recommendationConfidence      String  @db.VarChar(6)  // 'low' | 'medium' | 'high'
  workflowActual                WorkflowType            // FULL | QUICK | CLEAN (mirrors Ticket.workflowType)
  recommendationMatched         Boolean                 // predicted == workflowActual
  recommendationFrictionAligned Boolean                 // (predicted=QUICK && frictionFree) OR (predicted=FULL && !frictionFree)

  // Partial-state mirror (snapshotted from outcome at write time).
  partial       Boolean @default(false)
  partialReason String? @db.VarChar(40) // mirrors TicketOutcome.partialReason (no_jobs | no_branch_reference | merge_not_found | repository_unreachable | fetch_failed_after_retry | diff_truncated)

  // Relations
  ticket   Ticket         @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  project  Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  analysis TicketAnalysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  outcome  TicketOutcome  @relation(fields: [outcomeId], references: [id], onDelete: Cascade)

  @@index([projectId, shippedAt(sort: Desc)])  // dashboard: 30 most recent per project
  @@index([projectId, partial])                // dashboard: filter partials out of headline rates
  @@index([projectId, frictionCell])           // dashboard: confusion-matrix counts
}
```

### Back-pointers added to existing models (additive only)

```prisma
model Ticket {
  // ... existing fields unchanged ...
  calibration AnalysisCalibration?  // 1:1 (nullable until pairing has run)
}

model Project {
  // ... existing fields unchanged ...
  calibrations AnalysisCalibration[]
}

model TicketAnalysis {
  // ... existing fields unchanged ...
  calibration AnalysisCalibration?  // 1:1 with the paired analysis row, if any
}

model TicketOutcome {
  // ... existing fields unchanged ...
  calibration AnalysisCalibration?  // 1:1 with the paired outcome row, if any
}
```

These are **back-pointers only** — they add zero new columns to the existing tables and require no data backfill. Prisma adds them at the schema-relation layer, not the SQL layer.

### Validation invariants (enforced at the persistence layer)

`lib/calibration/persist.ts` validates each row against a Zod schema with `superRefine` cross-field guards. Mismatches throw before reaching the database. The invariants are:

1. **Friction binarisation matches the predicted rating**: `frictionPredictedClean === (frictionPredictedRating === 'low')`.
2. **Friction confusion cell matches the predicted/actual booleans**:
   - `frictionPredictedClean=true && frictionActualFree=true` ⇒ `frictionCell='TP'`
   - `frictionPredictedClean=false && frictionActualFree=false` ⇒ `frictionCell='TN'`
   - `frictionPredictedClean=true && frictionActualFree=false` ⇒ `frictionCell='FP'`
   - `frictionPredictedClean=false && frictionActualFree=true` ⇒ `frictionCell='FN'`
3. **Quality bounds order**: `qualityPredictedLower <= qualityPredictedUpper`.
4. **Quality verdict matches the actual + bounds**:
   - `qualityActual === null` ⇒ `qualityVerdict='n_a'`.
   - `qualityActual` ∈ `[qualityPredictedLower, qualityPredictedUpper]` ⇒ `qualityVerdict='hit'`.
   - Otherwise ⇒ `qualityVerdict='miss'`.
5. **Cost bounds order**: each component's lower ≤ upper.
6. **Cost summed range consistency**: `costPredictedSummedLowerUsd === costPredictedBaselineLowerUsd + costPredictedMarginalLowerUsd` (and the same for upper). Stored explicitly to keep read paths simple, but validated against the decomposed components on write.
7. **Cost verdict matches the actual + summed range**:
   - `costActualUsd === null` ⇒ `costVerdict='n_a'`.
   - `costActualUsd` ∈ `[costPredictedSummedLowerUsd, costPredictedSummedUpperUsd]` ⇒ `costVerdict='hit'`.
   - Otherwise ⇒ `costVerdict='miss'`.
8. **Recommendation matched**: `recommendationMatched === (recommendationPredicted === workflowActual)`.
9. **Recommendation friction-aligned**:
   - `recommendationFrictionAligned === ((recommendationPredicted === 'QUICK' && frictionActualFree) || (recommendationPredicted === 'FULL' && !frictionActualFree))`.
10. **Partial mirror**: `partial === true ⇔ partialReason !== null`. The `partialReason` value is one of the AIB-742 enum literals.

If any invariant fails, the row is **not** persisted; the pairing logs the violation with `{ ticketId, invariant }` and returns failure. SHIP and outcome capture are unaffected (the chain in `transition.ts` is fire-and-forget).

### Lifecycle

| Event | Effect |
|---|---|
| Outcome capture finishes (`status='created' \| 'duplicate'`) for ticket T | `pairCalibrationOnOutcome({ ticketId: T, projectId })` runs as the next link in the post-commit chain |
| Pairing finds existing calibration row for T | Phase 1 short-circuit — return early, no write |
| Pairing finds no `success` analysis for T | Return early, no row written; ticket excluded from drift but counts in adoption (FR-004) |
| Pairing finds latest `success` analysis but `outcome.partial=true` | Compute available verdicts, mark missing-data verdicts as `n_a`, persist `partial=true` with `partialReason` snapshot (FR-011) |
| Pairing succeeds | One row created, immutable thereafter |
| Race with retry: P2002 (unique violation) on `ticketId` | Treated as success, no second row created (P3 idempotency from `lib/outcomes/persist.ts`) |
| Ticket hard-delete | Calibration row cascades (per `onDelete: Cascade` on the FK to Ticket) |
| Project hard-delete | All calibration rows for the project cascade |
| Future re-ship of a ticket (out of scope per spec) | No new calibration row; the existing one is kept (immutability) |

### Indexes — query patterns supported

| Index | Query | Source |
|---|---|---|
| `@@unique([ticketId])` | `findUnique({ where: { ticketId } })` — Phase 1 idempotency check in pairing | `lib/calibration/pair.ts` |
| `@@unique([analysisId])` | Defensive — guarantees no analysis row is paired twice (e.g. via a future re-pair bug) | Schema-level invariant |
| `@@unique([outcomeId])` | Defensive — same as above for outcomes | Schema-level invariant |
| `@@index([projectId, shippedAt(sort: Desc)])` | `findMany({ where: { projectId }, orderBy: { shippedAt: 'desc' }, take: 30 })` — dashboard 30-row window | `lib/calibration/queries.ts` |
| `@@index([projectId, partial])` | Headline-rate denominators that exclude partials | `lib/calibration/queries.ts` |
| `@@index([projectId, frictionCell])` | `groupBy({ by: ['frictionCell'], where: { projectId, … } })` — confusion-matrix counts | `lib/calibration/queries.ts` |

---

## Constants and enums

Defined in `lib/calibration/types.ts`. The constants pin the calibration rules to a versioned identifier so future rule-set changes can be detected on read.

```ts
export const CALIBRATION_RULE_SET_VERSION = 1 as const;

export const FrictionCell = ['TP', 'TN', 'FP', 'FN'] as const;
export type FrictionCell = (typeof FrictionCell)[number];

export const Verdict = ['hit', 'miss', 'n_a'] as const;
export type Verdict = (typeof Verdict)[number];

// Mirrored from lib/outcomes/persist.ts PARTIAL_REASONS — kept in sync via a single import to avoid drift.
export type PartialReason =
  | 'no_jobs'
  | 'no_branch_reference'
  | 'merge_not_found'
  | 'repository_unreachable'
  | 'fetch_failed_after_retry'
  | 'diff_truncated';
```

The Zod schema at the persistence boundary uses `z.enum(FrictionCell)` and `z.enum(Verdict)`; pairings construct strings explicitly (no string concatenation, no Tailwind-style dynamic class building).

---

## Migration plan

```bash
bunx prisma migrate dev --name add_analysis_calibration
```

The generated SQL creates:
- One new table `"AnalysisCalibration"` with the columns above and the three indexes.
- Three foreign-key constraints (`ticketId → Ticket.id`, `projectId → Project.id`, `analysisId → TicketAnalysis.id`, `outcomeId → TicketOutcome.id`) — all `ON DELETE CASCADE`.
- Three unique constraints (`ticketId`, `analysisId`, `outcomeId`).

No data migration is required — existing shipped+analyzed tickets are deliberately not backfilled (see `research.md` D10). The dashboard's "30 of N" caption naturally reflects the post-launch dataset.

After the migration:

```bash
bunx prisma generate
```

regenerates the Prisma client (CLAUDE.md commit rule). The TypeScript types `Prisma.AnalysisCalibration*` are then available to `lib/calibration/`.

---

## Out-of-scope clarifications

- **No backfill** for historical shipped tickets — explicit per `research.md` D10. Future ticket if dogfood requires it.
- **No update / re-pair API** — FR-005 + FR-022. The model has no `updatedAt` column on purpose: any update path would be a code smell.
- **No per-analysis calibration history** — older `TicketAnalysis` rows for the same ticket remain on their original table (per AIB-743 FR-007), but they are not paired. This matches User Story 3.
- **No project-level "feature available" column** — derived from `MIN(TicketAnalysis.createdAt)` per project, see `research.md` D6.
