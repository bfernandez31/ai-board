# Data Model: Track Per-Turn Context Size on Jobs

## Entity Changes

### Job (extended)

Three new optional integer fields added to the existing `Job` model:

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `peakContextTokens` | `Int?` | Yes | null | Maximum `input_tokens` observed in any single API turn within this job |
| `avgContextTokens` | `Int?` | Yes | null | Mean `input_tokens` across all API turns (rounded to nearest integer) |
| `turnCount` | `Int?` | Yes | null | Total number of model API calls (turns) during this job |

**Constraints**:
- All three fields are null when: (a) the agent doesn't provide per-turn telemetry (Mistral, Gemini), (b) the job predates this feature, or (c) no telemetry was received
- All three fields are populated together (never partially) — either all three are set or all three remain null
- `peakContextTokens >= avgContextTokens` when both are populated
- `turnCount >= 1` when populated

**Prisma schema addition** (after line 54 in `prisma/schema.prisma`):
```prisma
// Per-turn context metrics (computed from per-turn telemetry spans)
// Populated only for agents that report per-turn input_tokens (Claude, Codex)
peakContextTokens   Int? // Maximum input tokens in any single turn
avgContextTokens    Int? // Mean input tokens across all turns
turnCount           Int? // Total number of model API calls
```

**Migration**: Standard `prisma migrate dev` — nullable columns with no default, no backfill needed. Historical jobs remain null.

## Computed Display Types (not stored)

### Context Health Tier

Derived at render time from `peakContextTokens`:

| Tier | Condition | Color | Label |
|------|-----------|-------|-------|
| `healthy` | peak < 50,000 | green (`text-ctp-green`) | Healthy |
| `warning` | 50,000 ≤ peak < 100,000 | yellow (`text-ctp-yellow`) | Warning |
| `danger` | peak ≥ 100,000 | red (`text-ctp-red`) | Danger |

When `peakContextTokens` is null, no tier is computed and no indicator is rendered.

### Quality Score Bucket

Derived at query/render time from existing `qualityScore` field:

| Bucket | Range | Label |
|--------|-------|-------|
| Excellent | 90–100 | Excellent |
| Good | 70–89 | Good |
| Fair | 50–69 | Fair |
| Poor | 30–49 | Poor |
| Critical | 0–29 | Critical |

Jobs without a quality score are excluded from bucket grouping (shown as "N/A" or omitted).

### Context Size Bucket (for analytics distribution)

Derived at query time for the distribution chart:

| Bucket | Range | Label |
|--------|-------|-------|
| 0–25K | 0 ≤ peak < 25,000 | 0–25K |
| 25–50K | 25,000 ≤ peak < 50,000 | 25–50K |
| 50–75K | 50,000 ≤ peak < 75,000 | 50–75K |
| 75–100K | 75,000 ≤ peak < 100,000 | 75–100K |
| 100–150K | 100,000 ≤ peak < 150,000 | 100–150K |
| 150K+ | peak ≥ 150,000 | 150K+ |

## Relationships

No new relationships. The three fields are direct attributes on the existing `Job` model, accessible through the existing `Ticket → Job` relation.

## Indexes

No new indexes required. Context metrics are only queried:
1. As part of the existing job-by-ticket query (already indexed on `ticketId`)
2. In analytics aggregation queries that scan by `projectId` + `completedAt` (already indexed)

The analytics query filters on `peakContextTokens: { not: null }` which Prisma translates to a simple WHERE clause — acceptable for read-only analytics without a dedicated index given the existing composite index on `(ticketId, status, startedAt)`.
