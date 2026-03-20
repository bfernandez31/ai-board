# Data Model: Replace PR Comments with Spec Sync

## No Schema Changes Required

This feature does NOT modify the Prisma schema. The `Job` model already has:
- `qualityScore Int?` — integer 0-100
- `qualityScoreDetails String?` — JSON string with dimension breakdown

The change is purely in the **application layer**: what dimension data gets written to and read from these fields.

## Entity: DimensionConfig (NEW TypeScript type)

Replaces the current `DIMENSION_WEIGHTS: Record<string, number>` with a richer typed config.

```typescript
interface DimensionConfig {
  agentId: string;        // Unique identifier (e.g., "spec-sync")
  name: string;           // Display name (e.g., "Spec Sync")
  weight: number;         // 0.00-1.00, contribution to global score
  order: number;          // Display ordering
}
```

### Instances (5 dimensions)

| agentId | name | weight | order |
|---------|------|--------|-------|
| compliance | Compliance | 0.40 | 1 |
| bug-detection | Bug Detection | 0.30 | 2 |
| code-comments | Code Comments | 0.20 | 3 |
| historical-context | Historical Context | 0.10 | 4 |
| spec-sync | Spec Sync | 0.00 | 5 |

### Validation Rules

- All `agentId` values must be unique
- Active weights (weight > 0) must sum to 1.00
- Total dimension count must equal 5 (FR-012)
- Weight range: 0.00 to 1.00

## Entity: DimensionScore (EXISTING — no changes)

Stored in `qualityScoreDetails` JSON. Structure unchanged:

```typescript
interface DimensionScore {
  name: string;           // Display name at time of computation
  agentId: string;        // Agent identifier
  score: number;          // 0-100
  weight: number;         // Weight at time of computation
  weightedScore: number;  // score * weight
}
```

**Historical note**: Old records have `agentId: "pr-comments"` and `name: "PR Comments"`. New records will have `agentId: "spec-sync"` and `name: "Spec Sync"`. Display components handle both.

## Entity: QualityScoreDetails (EXISTING — no changes)

```typescript
interface QualityScoreDetails {
  dimensions: DimensionScore[];
  threshold: ScoreThreshold;
  computedAt: string;     // ISO 8601
}
```
