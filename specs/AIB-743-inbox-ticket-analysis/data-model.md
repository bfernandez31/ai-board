# Data Model: AIB-743 Inbox Ticket Analysis

**Branch**: `AIB-743-inbox-ticket-analysis` · **Date**: 2026-04-27

This document defines the new persistent entity, its fields/types/indexes, the state machine, and the embedded structures that drive the panel UI.

---

## 1. New Prisma model — `TicketAnalysis`

Append-only row created on every analysis run. The latest row drives the panel; older rows are retained for audit and future calibration (Why Now in spec). Per FR-005 / FR-006 / SC-009 the row is **never** UPDATEd after reaching a terminal status — exactly one allowed transition: `running → success | cold_start | failed`.

```prisma
model TicketAnalysis {
  id                Int                    @id @default(autoincrement())

  // Identity
  ticketId          Int
  projectId         Int
  userId            String                 // user who triggered the run

  // Lifecycle
  status            TicketAnalysisStatus   @default(running)
  startedAt         DateTime               @default(now())
  endedAt           DateTime?

  // Versioning
  ruleSetVersion    Int                    // ANALYSIS_RULE_SET_VERSION at run time
  agent             Agent                  // CLAUDE | CODEX | MISTRAL | GEMINI (see existing enum)
  modelId           String?                @db.VarChar(50)  // resolved model from project config

  // Input snapshot (used for stale-detection comparison)
  titleSnapshot     String                 @db.VarChar(100)
  descriptionSnapshot String               @db.VarChar(10000)

  // Stack snapshot (read-only audit; not used for live re-prompting)
  stackSnapshot     Json                   // StackContext (D4 in research.md)

  // Telemetry (filled when status transitions to success / cold_start)
  costUsd           Float?
  durationMs        Int?
  inputTokens       Int?
  outputTokens      Int?
  thinkingTokens    Int?
  cacheReadTokens   Int?

  // Cold-start metadata
  coldStartReason   String?                @db.VarChar(40)   // null unless status=cold_start

  // Failure metadata
  errorReason       String?                @db.VarChar(40)   // null unless status=failed
  errorMessage      String?                @db.VarChar(2000) // null unless status=failed

  // Output payload (null when status=running OR status=failed)
  // Conforms to AnalysisOutputSchema (lib/analysis/output-schema.ts).
  output            Json?

  // Relations
  ticket            Ticket                 @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  project           Project                @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user              User                   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([ticketId, createdAt(sort: Desc)])           // panel: "latest analysis for ticket"
  @@index([userId, status, endedAt])                   // rate-limit query (D2)
  @@index([projectId, createdAt(sort: Desc)])          // future analytics
  @@index([status, startedAt])                         // janitor / observability

  // Note: createdAt added by Prisma idiom; explicitly:
  createdAt         DateTime               @default(now())
}

enum TicketAnalysisStatus {
  running
  success
  cold_start
  failed
}
```

### Relation back-pointers added to existing models

```prisma
model Ticket {
  // … existing fields …
  analyses     TicketAnalysis[]
}

model Project {
  // … existing fields …
  analyses     TicketAnalysis[]
}

model User {
  // … existing fields …
  ticketAnalyses TicketAnalysis[]
}
```

### Field rules & validation

| Field | Rule | Why |
|---|---|---|
| `status` | Initial = `running` (DB default). Only `running → {success, cold_start, failed}` is allowed; terminal rows are immutable. | FR-005, P4 in research.md |
| `endedAt` | Set when status transitions to terminal. NULL while `running`. | Rate-limit query (D2) requires it for the rolling-hour window. |
| `userId` | The session user who clicked the trigger. Captured at POST time, never re-derived. | FR-019 rate-limit scoping; FR-022 audit. |
| `titleSnapshot` | Length ≤ 100 (Zod min(1).max(100)) — matches `Ticket.title @db.VarChar(100)`. | Constitution IV ("Zod constraints MUST match DB column constraints"). |
| `descriptionSnapshot` | Length ≤ 10 000 — matches `Ticket.description @db.VarChar(10000)`. | Same. |
| `stackSnapshot` | JSON conforming to `StackContextSchema` (Zod). Stripped of secrets. | D4. |
| `output` | NULL when status = running/failed. JSON conforming to `AnalysisOutputSchema` when status = success. NULL when status = cold_start (panel reads `coldStartReason` + scope warnings only — see §3 below). | FR-014, D7. |
| `coldStartReason` | NULL unless `status = cold_start`. Enum-like string in `{ insufficient_comparable_history }`. | FR-014. |
| `errorReason` | NULL unless `status = failed`. Enum-like string in `{ scoping_pass_failed, grounded_pass_failed, dispatch_failed, timeout, invalid_model_output, credential_missing, other }`. | FR-023. |
| `costUsd`, `durationMs`, tokens | Filled from workflow PATCH on success/cold_start. NULL on failure. | FR-022. |
| `ruleSetVersion` | Stamped from `ANALYSIS_RULE_SET_VERSION` constant at insert time. | D8. |
| `agent` + `modelId` | Resolved from project config + ticket model overrides at insert time. | FR-016, D4. |

### Index rationale

| Index | Query it serves |
|---|---|
| `[ticketId, createdAt DESC]` | Panel render: `findFirst({ where: { ticketId }, orderBy: { createdAt: 'desc' } })`. Constant-time. |
| `[userId, status, endedAt]` | Rate-limit: `count({ where: { userId, status: { in: ['success','cold_start'] }, endedAt: { gt: oneHourAgo } } })`. |
| `[projectId, createdAt DESC]` | Future analytics; not on the hot path. |
| `[status, startedAt]` | Janitor: locate orphaned `running` rows older than X hours (operational sanity, not an MVP feature). |

### Migration

`prisma/migrations/<timestamp>_add_ticket_analysis/migration.sql` is generated by `bunx prisma migrate dev --name add_ticket_analysis`. Migration is additive (new table + new enum + new FKs); no data backfill needed.

---

## 2. Embedded JSON structures

### 2.1 `stackSnapshot` (Json column)

```ts
// lib/analysis/types.ts
export const StackContextSchema = z.object({
  language: z.string().nullable(),         // 'typescript' | 'python' | …
  framework: z.string().nullable(),        // 'nextjs' | 'fastapi' | 'none' | …
  services: z.array(z.object({
    type: z.enum(['postgres','redis','mysql','mongo']),
    version: z.string(),
  })).max(10),
  testingFramework: z.string().nullable(), // 'vitest' | 'pytest' | …
  e2e: z.boolean(),
  e2eFramework: z.string().nullable(),     // 'playwright' | null
  agent: z.object({
    cli: z.string(),                       // 'claude-code' | 'codex'
    model: z.string().nullable(),          // 'claude-opus-4-7' | …
  }),
});
export type StackContext = z.infer<typeof StackContextSchema>;
```

Built by `lib/analysis/stack-extract.ts` from `Project.config` (the existing JSON column already populated by `lib/config-loader.ts`). Missing fields → `null` / `[]` (D4 graceful fallback).

### 2.2 `output` (Json column) — `AnalysisOutputSchema`

```ts
// lib/analysis/output-schema.ts
export const FrictionRiskEnum = z.enum(['low','medium','high']);
export const ConfidenceEnum   = z.enum(['low','medium','high']);
export const RecommendationEnum = z.enum(['QUICK','FULL']);

export const ScopeWarningCategoryEnum = z.enum([
  'ambiguity_core_requirement',
  'multi_feature_bundling',
  'missing_acceptance_criteria',
  'missing_scope_boundary',
  'other',
]);

export const ScopeWarningSchema = z.object({
  category: ScopeWarningCategoryEnum,
  message: z.string().min(1).max(280),  // single-sentence cap
});

export const AnchorCitationSchema = z.object({
  ticketId:        z.number().int().positive(),
  ticketKey:       z.string().regex(/^[A-Z]{2,6}-\d+$/),  // e.g. "AIB-123"
  frictionFree:    z.boolean(),
  qualityScore:    z.number().int().min(0).max(100).nullable(), // null = "no score" (QUICK)
  overlapStrength: z.number().int().min(1),                     // # domain matches
});

export const QualityGateRangeSchema = z.object({
  lower: z.number().int().min(0).max(100),
  upper: z.number().int().min(0).max(100),
}).refine((r) => r.lower <= r.upper, { message: 'lower must be ≤ upper' });

export const CostRangeSchema = z.object({
  baselineLowerUsd:        z.number().min(0),
  baselineUpperUsd:        z.number().min(0),
  marginalFrictionLowerUsd: z.number().min(0),
  marginalFrictionUpperUsd: z.number().min(0),
}).refine((r) => r.baselineLowerUsd <= r.baselineUpperUsd
              && r.marginalFrictionLowerUsd <= r.marginalFrictionUpperUsd,
   { message: 'lower bounds must be ≤ upper bounds' });

export const AnalysisOutputSchema = z.object({
  frictionRisk:   FrictionRiskEnum,
  qualityGateRange: QualityGateRangeSchema,
  recommendation: z.object({
    choice:        RecommendationEnum,
    confidence:    ConfidenceEnum,
    justification: z.string().min(1).max(1000),
  }),
  costRange:      CostRangeSchema,
  scopeWarnings:  z.array(ScopeWarningSchema).max(5),
  anchors:        z.array(AnchorCitationSchema).max(5),
});

export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;
```

**Cold-start variant**: when `status = cold_start`, the `output` column is NULL. The panel reads `coldStartReason` + a separately persisted `coldStartScopeWarnings` field. To avoid a parallel column, **scope warnings on cold-start runs are stored under a reduced JSON column**:

```ts
export const ColdStartOutputSchema = z.object({
  scopeWarnings: z.array(ScopeWarningSchema).max(5),
});
```

Stored in `output` Json with the discriminator implicit in `status` — i.e. the API serialiser inspects `status` and parses `output` against the appropriate schema. This avoids a second JSON column for a rarely-distinct shape.

### 2.3 `errorReason` enum-like string (no Prisma enum)

Stored as `VarChar(40)` for forward compatibility; a Zod enum gates writes:

```ts
export const AnalysisErrorReason = z.enum([
  'scoping_pass_failed',
  'grounded_pass_failed',
  'dispatch_failed',
  'timeout',
  'invalid_model_output',
  'credential_missing',
  'other',
]);
```

---

## 3. State machine

```
                ┌──────────────────────────────────────────┐
                │                                          │
   POST /analysis (creates row)                            │
                │                                          │
                ▼                                          │
            ┌────────┐                                     │
            │ running│  (workflow_dispatch fired)          │
            └───┬────┘                                     │
                │                                          │
       ┌────────┼─────────┬────────────┐                   │
       │        │         │            │                   │
       ▼        ▼         ▼            ▼                   │
   ┌───────┐┌───────────┐┌──────┐                          │
   │success││cold_start ││failed│                          │
   └───────┘└───────────┘└──────┘                          │
   (terminal — never UPDATE again)                         │
```

**Allowed writes**:
- INSERT: only by POST trigger handler. Row born `running`.
- UPDATE (the **single** transition): only by PATCH `/status` workflow endpoint, with assertion `WHERE id = ? AND status = 'running'`. Affected count must be 1; otherwise return 409 (race) or 200 idempotent (already terminal).
- No other UPDATEs anywhere.

**Concurrency** (D9): two `running` rows for the same ticket may coexist. The panel reads `findFirst({ where: { ticketId }, orderBy: { createdAt: 'desc' } })` which trivially picks the latest by `createdAt`.

---

## 4. Anchor projection (in-memory, not persisted as separate rows)

The spec entity "AnchorReference" is **not** materialised as a separate model. Anchors are persisted inline as part of the `output` JSON (`AnchorCitationSchema[]`, see §2.2) — this satisfies SC-012 (anchors carry friction status + quality score at analysis time, captured into the row, immune to later changes on the source ticket).

Why no separate model:
- Anchors are tightly coupled to a single analysis run; lifetime is identical to the row.
- Querying anchors independently is not a use case in v1 (FR-018: anchor entries are rendered as part of the panel; SC-008 access filtering is a render-time concern; SC-012 is satisfied by row-immutability).
- A separate table would force two writes per analysis and a join on every panel paint — premature.

---

## 5. Validation rules summary (centralised in Zod)

| Rule | Schema | Enforcement point |
|---|---|---|
| `titleSnapshot` ≤ 100 chars | `AnalysisInputSnapshotSchema` | POST handler |
| `descriptionSnapshot` ≤ 10 000 chars | `AnalysisInputSnapshotSchema` | POST handler |
| `output.scopeWarnings.length` ≤ 5 | `AnalysisOutputSchema` | PATCH handler |
| `output.anchors.length` ≤ 5 | `AnalysisOutputSchema` | PATCH handler |
| `output.qualityGateRange.lower ≤ upper` | `QualityGateRangeSchema.refine` | PATCH handler |
| `output.costRange.*Lower ≤ *Upper` | `CostRangeSchema.refine` | PATCH handler |
| `output.anchors[*].ticketId` ⊆ anchors selected at scoping time | Custom refinement in PATCH handler against the row's `anchorIdsAttempted` (see below) | PATCH handler |
| `output.recommendation.justification.length` ≤ 1000 | `AnalysisOutputSchema` | PATCH handler |
| Status transition `running → terminal` only | `VALID_TRANSITIONS` map | PATCH handler |
| Re-PATCH on terminal row | Idempotent 200 (no DB write) | PATCH handler |
| Rate limit (10/h/user, success+cold_start) | `count(...) < 10` query | POST handler (returns 429 if exceeded) |
| INBOX-only triggering | `ticket.stage === 'INBOX'` | POST handler (returns 409 / 422 if not INBOX) |
| User has access to ticket | `verifyTicketAccess` | POST + GET handlers |

---

## 6. Anchor-IDs-attempted (write-once column added if needed)

To enforce the "anchors[*] ⊆ selected anchors" invariant on PATCH, the row must remember the candidate anchor IDs that the workflow was asked to consider. Two options:

- **Option A (recommended)**: store the candidate set inline on the row at insert time as a JSON array column `anchorIdsAttempted Int[] @default([])`. Written once by the POST handler **after** running `selectAnchors()`, read by PATCH for validation.
- **Option B**: derive the candidate set on PATCH by re-running `selectAnchors()`. Rejected because outcome data may have changed between trigger and completion → false validation failures.

**Decision**: Option A. Add `anchorIdsAttempted Int[] @default([])` to the model.

```prisma
model TicketAnalysis {
  // … fields above …
  anchorIdsAttempted Int[] @default([])  // candidate anchor ticketIds passed to scoping
  // …
}
```

This also makes the run debuggable: a failed analysis row records what anchors *would have been* used.

---

## 7. Removed / not-introduced artefacts

| Item | Why not |
|---|---|
| `AnalysisRateBudget` table (from spec entities) | Replaced by indexed query on `TicketAnalysis` (D2). |
| `AnchorReference` table (from spec entities) | Inlined as `AnchorCitationSchema[]` in `output` JSON (§4). |
| Soft-delete (`deletedAt`) on `TicketAnalysis` | Not needed: append-only audit trail; cascade-on-Ticket-delete is sufficient (Ticket has cascade FK). |
| Update timestamp (`updatedAt`) | Not needed: terminal rows are immutable; any "update" is a transition write that also sets `endedAt`. |

---

## 8. Constitution compliance checklist (this entity)

- [x] Strict TypeScript types with explicit interfaces (`StackContext`, `AnalysisOutput`).
- [x] Prisma model + Zod schemas with matching constraints (constitution IV).
- [x] No raw SQL.
- [x] Foreign keys with cascade where appropriate (Ticket / Project / User).
- [x] Status transitions enforced by valid-transitions map (constitution V).
- [x] No optional fields without defaults or explicit null handling.
- [x] Append-only invariant matches AIB-742 doctrine.
