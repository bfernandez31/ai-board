# Data Model: Analysis Calibration

**Branch**: `AIB-773-copy-of-analysis` | **Date**: 2026-05-05

## Entities

### `AnalysisOutcomePairing` (NEW)

One row per shipped ticket that had at least one stored analysis at SHIP time. Persisted in PostgreSQL via Prisma.

**Prisma model** (to add to `prisma/schema.prisma` near the `TicketOutcome` and `TicketAnalysis` models):

```prisma
model AnalysisOutcomePairing {
  id Int @id @default(autoincrement())

  // Identity & lookup
  ticketId   Int      @unique
  projectId  Int
  analysisId Int      // The analysis chosen as the basis (most recent at pairing time)
  outcomeId  Int      @unique
  pairedAt   DateTime @default(now())
  shippedAt  DateTime
  ruleSetVersion Int  @default(1)

  // Friction dimension
  predictedFriction      String   @db.VarChar(10)  // 'low' | 'medium' | 'high'
  actualFrictionFree     Boolean
  frictionPredictedLow   Boolean  // true if predictedFriction == 'low'
  frictionMatch          Boolean  // (predictedLow && frictionFree) || (!predictedLow && !frictionFree)
  frictionEmerged        Boolean  // !actualFrictionFree, surfaced explicitly per spec edge case
  frictionIncomparable   Boolean  @default(false)

  // Cost dimension
  predictedCostLowerUsd      Float?
  predictedCostUpperUsd      Float?  // marginalFrictionUpperUsd (envelope)
  predictedBaselineUpperUsd  Float?  // baseline upper, retained for audit
  actualCostUsd              Float?
  costInRange                Boolean? // null when incomparable
  costMissDirection          String?  @db.VarChar(8) // 'under' | 'over' | null
  costIncomparable           Boolean  @default(false)

  // Quality dimension
  predictedQualityLower      Int?
  predictedQualityUpper      Int?
  actualQualityScore         Int?
  qualityInRange             Boolean?
  qualityMissDirection       String?  @db.VarChar(8) // 'under' | 'over'
  qualityIncomparable        Boolean  @default(false)

  // Workflow recommendation dimension
  predictedRecommendation    String   @db.VarChar(8) // 'QUICK' | 'FULL'
  actualWorkflowType         String   @db.VarChar(8) // 'QUICK' | 'FULL' | 'CLEAN'
  recommendationMatch        Boolean
  recommendationIncomparable Boolean  @default(false)

  // Pairing lifecycle
  unpairedReason String? @db.VarChar(40) // null = paired; otherwise: 'outcome_missing_24h', 'analysis_missing', 'output_unparseable'
  pendingOutcome Boolean @default(false) // true while waiting for outcome capture; flipped false when paired or expired

  // Relations
  ticket   Ticket          @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  project  Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  analysis TicketAnalysis  @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  outcome  TicketOutcome?  @relation(fields: [outcomeId], references: [id], onDelete: Cascade)

  @@index([projectId, shippedAt(sort: Desc)])
  @@index([projectId, unpairedReason])
  @@index([pendingOutcome, shippedAt])
}
```

**Required reverse relations** (add to existing models):
- `Ticket.analysisOutcomePairing AnalysisOutcomePairing?`
- `Project.analysisOutcomePairings AnalysisOutcomePairing[]`
- `TicketAnalysis.pairing AnalysisOutcomePairing?`
- `TicketOutcome.pairing AnalysisOutcomePairing?`

**Validation rules**:
- `frictionIncomparable=true` ⇒ all friction fields nullable/default; `frictionMatch` MUST be `false`.
- `costIncomparable=true` ⇒ `costInRange=null`, `costMissDirection=null`, `predictedCost*` nullable.
- `qualityIncomparable=true` ⇒ `qualityInRange=null`, `qualityMissDirection=null`, `predictedQuality*` nullable.
- `predictedFriction ∈ {'low','medium','high'}` (matches `FrictionRiskEnum`).
- `costMissDirection`: `'under'` if `actualCostUsd < predictedCostLowerUsd`, `'over'` if `> predictedCostUpperUsd`, else `null`.
- `qualityMissDirection`: same convention against `predictedQualityLower/Upper`.
- `unpairedReason !== null` ⇒ pairing is excluded from drift panels (`unpairedReason IS NULL` filter on dashboard queries).
- `pendingOutcome=true` ⇒ `unpairedReason IS NULL` (still inside the 24h retry window).

**State transitions**:

```
[no row]  ── ship + analysis + outcome present ──▶  [paired: pendingOutcome=false, unpairedReason=null]
[no row]  ── ship + analysis + outcome missing  ──▶  [pendingOutcome=true, unpairedReason=null]
[pending] ── outcome arrives, retry succeeds    ──▶  [paired: pendingOutcome=false, unpairedReason=null]
[pending] ── 24h elapses without outcome        ──▶  [pendingOutcome=false, unpairedReason='outcome_missing_24h']
[no row]  ── ship without analysis              ──▶  [no row created — FR-004]
[paired]  ── duplicate ship event                ──▶  [no-op via upsert idempotency on ticketId]
```

### `TicketAnalysis` — extension (EXISTING, ADD FIELD)

Add a `countedInDrift` boolean to flag which analysis is the basis of pairing.

```prisma
model TicketAnalysis {
  // … existing fields unchanged …

  countedInDrift Boolean @default(false)

  // … existing relations and indexes …
}
```

**Validation rules**:
- Default `false` for all analyses.
- At pairing time, exactly one analysis per ticket has `countedInDrift=true`. Pairing function MUST set the chosen analysis to `true` and any other analyses for the same ticket to `false` in the same transaction.
- Re-analyses created after pairing inherit the default `false` and never change to `true` unless an explicit re-pairing operation runs (out of scope).

### `DriftDashboardSnapshot` (COMPUTED VIEW, NOT STORED)

Aggregated representation surfaced by `GET /api/projects/:projectId/drift`. Computed at request time from `AnalysisOutcomePairing` (filtered to `unpairedReason IS NULL`) joined with the inbox-leaver count.

**Shape** (TypeScript, see `contracts/drift-api.md` for canonical form):

```typescript
interface DriftDashboardSnapshot {
  projectId: number;
  generatedAt: string;          // ISO timestamp
  sampleSize: number;           // count of paired records (paired only, unpairedReason=null)
  unpairedCount: number;        // count of pairings with unpairedReason set
  pendingCount: number;         // count of pendingOutcome=true rows still in retry window

  friction: {
    incomparable: number;
    matrix: { tp: number; fp: number; tn: number; fn: number };
    precision: number | null;   // null when (tp+fp)==0
    recall: number | null;      // null when (tp+fn)==0
  };

  cost: {
    incomparable: number;
    inRange: number;
    under: number;
    over: number;
  };

  quality: {
    incomparable: number;
    inRange: number;
    under: number;
    over: number;
  };

  usage: {
    analysedShipped: number;    // count of paired (and unpaired/pending) — i.e. SHIPped tickets that had ≥1 analysis
    leftInbox: number;          // count of project tickets where stage != INBOX
    ratio: number;              // analysedShipped / leftInbox; 0 when leftInbox==0
  };

  recentPairings: Array<{
    ticketId: number;
    ticketKey: string;
    shippedAt: string;
    frictionMatch: boolean | null;
    costInRange: boolean | null;
    qualityInRange: boolean | null;
    recommendationMatch: boolean | null;
  }>;                            // top N=30 ordered by shippedAt desc; pagination via separate ?cursor= param
}
```

**Validation rules**:
- `sampleSize == matrix.tp + matrix.fp + matrix.tn + matrix.fn + friction.incomparable` MUST hold (sanity check in tests).
- `cost.inRange + cost.under + cost.over + cost.incomparable == sampleSize` MUST hold.
- `quality.inRange + quality.under + quality.over + quality.incomparable == sampleSize` MUST hold.
- `precision = tp / (tp + fp)` (rounded to 3 decimals); `recall = tp / (tp + fn)` (rounded to 3 decimals).
- `usage.analysedShipped` includes paired AND unpaired-with-reason rows (a ticket that had an analysis and shipped is counted regardless of whether the outcome arrived) — but excludes `pendingOutcome=true` rows still in the window (those are "in flight").
- `usage.leftInbox` is `SELECT COUNT(*) FROM Ticket WHERE projectId=? AND stage != 'INBOX'`.

## Relationships Summary

```
Project ────┬──< TicketAnalysis
            ├──< TicketOutcome
            ├──< Ticket >── (already exists)
            └──< AnalysisOutcomePairing

Ticket ─────┬─── TicketAnalysis (1:N)
            ├─── TicketOutcome (1:1)
            └─── AnalysisOutcomePairing (1:1, ticketId UNIQUE)

TicketAnalysis ─── AnalysisOutcomePairing (1:0..1)
TicketOutcome ───── AnalysisOutcomePairing (1:0..1)
```

## Migration Notes

- Single Prisma migration: `add_analysis_outcome_pairing` adds `AnalysisOutcomePairing` table and `TicketAnalysis.countedInDrift` field.
- No backfill required: existing tickets without pairings are fine; the dashboard renders an empty state per spec.
- Indexes match dashboard query patterns: `(projectId, shippedAt DESC)` for recent-N listing; `(projectId, unpairedReason)` for filtering paired vs unpaired; `(pendingOutcome, shippedAt)` for the 24h sweep.
