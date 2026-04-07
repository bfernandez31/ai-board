# Data Model: Display Health Score Heart Indicator

**Feature Branch**: `AIB-546-display-health-score`
**Created**: 2026-04-07

## Entities

### HealthScore (Existing — No Changes)

The `HealthScore` model already exists in `prisma/schema.prisma` with all required fields. **No schema migration needed.**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int` (PK, auto) | Primary key |
| `projectId` | `Int` (unique) | Foreign key to Project |
| `globalScore` | `Int?` | Aggregate score 0-100, null = never scanned |
| `securityScore` | `Int?` | Security sub-score |
| `complianceScore` | `Int?` | Compliance sub-score |
| `testsScore` | `Int?` | Tests sub-score |
| `specSyncScore` | `Int?` | Spec Sync sub-score |
| `qualityGate` | `Int?` | Quality Gate sub-score |
| `reviewQualityScore` | `Int?` | Review Quality sub-score |

**Relationship**: One-to-one with `Project` (Project has optional `healthScore?: HealthScore`)

### Project (Existing — Query Change Only)

No schema changes. The `getUserProjects()` query is extended to include the `healthScore` relation.

**New select fields added to query**:
```typescript
healthScore: {
  select: {
    globalScore: true,
    securityScore: true,
    complianceScore: true,
    testsScore: true,
    specSyncScore: true,
    qualityGate: true,
    reviewQualityScore: true,
  }
}
```

## Type Extensions

### ProjectWithCount (Extended)

New field added to the `ProjectWithCount` interface:

```typescript
healthScore: {
  globalScore: number | null;
  securityScore: number | null;
  complianceScore: number | null;
  testsScore: number | null;
  specSyncScore: number | null;
  qualityGate: number | null;
  reviewQualityScore: number | null;
} | null;  // null = project has no HealthScore record
```

## Score Threshold Mapping (Existing — No Changes)

| Range | Label | Color Token | Glow Color |
|-------|-------|-------------|------------|
| 90-100 | Excellent | `text-ctp-green` | `ctp-green` |
| 70-89 | Good | `text-ctp-blue` | `ctp-blue` |
| 50-69 | Fair | `text-ctp-yellow` | `ctp-yellow` |
| 0-49 | Poor | `text-ctp-red` | `ctp-red` |
| null | No data | `text-muted-foreground` | none |

## State Transitions

No state transitions apply — HealthScore is read-only in this feature. Score values are updated by the health-scan workflow (out of scope).
