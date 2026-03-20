# Contract: Quality Score JSON Output

## No API Changes

This feature does not modify any REST API endpoints. The existing contract remains:

### PATCH `/api/jobs/:id/status`

**Request body** (unchanged):
```json
{
  "status": "COMPLETED",
  "qualityScore": 83,
  "qualityScoreDetails": "<JSON string>"
}
```

### Quality Score JSON Structure (stdout marker)

**Format**: `QUALITY_SCORE_JSON:<json>` (single line, no spaces between marker and JSON)

**Updated JSON** (Spec Sync replaces PR Comments):
```json
{
  "version": 1,
  "qualityScore": 83,
  "threshold": "Good",
  "dimensions": [
    {
      "name": "Compliance",
      "agentId": "compliance",
      "score": 90,
      "weight": 0.40,
      "weightedScore": 36
    },
    {
      "name": "Bug Detection",
      "agentId": "bug-detection",
      "score": 80,
      "weight": 0.30,
      "weightedScore": 24
    },
    {
      "name": "Code Comments",
      "agentId": "code-comments",
      "score": 70,
      "weight": 0.20,
      "weightedScore": 14
    },
    {
      "name": "Historical Context",
      "agentId": "historical-context",
      "score": 85,
      "weight": 0.10,
      "weightedScore": 8.5
    },
    {
      "name": "Spec Sync",
      "agentId": "spec-sync",
      "score": 100,
      "weight": 0.00,
      "weightedScore": 0
    }
  ],
  "computedAt": "2026-03-20T10:00:00.000Z"
}
```

**Changes from current**:
- `compliance.weight`: 0.30 → 0.40
- `pr-comments` dimension removed
- `spec-sync` dimension added with weight 0.00
- `qualityScore` = `round(90*0.40 + 80*0.30 + 70*0.20 + 85*0.10)` = `round(36+24+14+8.5)` = 83
- Spec Sync score does NOT contribute to `qualityScore` (weight 0.00)

### Dimension Config Export (TypeScript)

```typescript
// lib/quality-score.ts
export const DIMENSION_CONFIG: DimensionConfig[];
export function getDimensionWeight(agentId: string): number;
export function getDimensionName(agentId: string): string;
```
