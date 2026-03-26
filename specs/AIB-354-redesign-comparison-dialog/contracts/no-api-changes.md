# API Contracts: Redesign Comparison Dialog

## No API Changes Required

This feature is a **UI-only redesign** (FR-022). All existing API endpoints remain unchanged:

### Existing Endpoints (unchanged)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/projects/:projectId/tickets/:id/comparisons/check` | Check if comparisons exist |
| GET | `/api/projects/:projectId/tickets/:id/comparisons` | List comparisons |
| GET | `/api/projects/:projectId/tickets/:id/comparisons/:comparisonId` | Get comparison detail |
| POST | `/api/projects/:projectId/tickets/:id/comparisons` | Persist comparison |

### Data Contract

The `ComparisonDetail` response schema (returned by the detail endpoint) provides all data needed for the redesigned UI. No new fields are required.

See `lib/types/comparison.ts` lines 466-480 for the full `ComparisonDetail` interface.

### New Component Prop Interfaces

New component prop types will be added to `components/comparison/types.ts`:

```typescript
// Hero card props
interface ComparisonHeroCardProps {
  winner: ComparisonParticipantDetail;
  recommendation: string;
  keyDifferentiators: string[];
  generatedAt: string;
  sourceTicketKey: string;
}

// Participant grid props
interface ComparisonParticipantGridProps {
  participants: ComparisonParticipantDetail[]; // non-winners only
  winnerTicketId: number;
}

// Stat cards props
interface ComparisonStatCardsProps {
  winner: ComparisonParticipantDetail;
  participants: ComparisonParticipantDetail[];
}

// Unified metrics props (replaces both MetricsGrid and OperationalMetrics)
interface ComparisonUnifiedMetricsProps {
  participants: ComparisonParticipantDetail[];
}

// Compliance heatmap props (replaces ComplianceGrid)
interface ComparisonComplianceHeatmapProps {
  rows: ComparisonComplianceRow[];
  participants: ComparisonParticipantDetail[];
}

// Enhanced decision points props
interface ComparisonDecisionPointsProps {
  decisionPoints: ComparisonDecisionPoint[];
  winnerTicketId: number; // new: needed for verdict dot coloring
}

// Score gauge props (reusable)
interface ScoreGaugeProps {
  score: number;
  size: number; // diameter in px
  strokeWidth: number;
  animated?: boolean; // default true, respects prefers-reduced-motion
}
```
