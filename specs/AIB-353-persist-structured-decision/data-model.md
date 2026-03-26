# Data Model: AIB-353 — Persist Structured Decision Points

## Existing Entities (No Schema Changes Required)

### DecisionPointEvaluation (prisma/schema.prisma:408-424)

Already supports the required structure:

| Field | Type | Description |
|-------|------|-------------|
| id | Int (PK, auto) | Primary key |
| comparisonRecordId | Int (FK) | Parent comparison |
| title | String | Decision area title |
| verdictTicketId | Int? (FK) | Per-point winner (null = tie) |
| verdictSummary | String | Why this ticket won this point |
| rationale | String | Detailed reasoning |
| participantApproaches | Json | Per-ticket approach descriptions |
| displayOrder | Int | Rendering order |

### participantApproaches JSON Shape

Current shape (already in use by `normalizeDecisionPoints()` at `lib/comparison/comparison-record.ts:499-538`):

```typescript
Array<{
  ticketId: number;
  ticketKey: string;
  summary: string;
}>
```

No changes needed — the structured data from the AI payload will be mapped into this existing shape.

## New TypeScript Types (Report Payload)

### ReportDecisionPoint (new — added to ComparisonReport)

Represents a structured decision point in the AI-generated JSON payload before persistence:

```typescript
interface ReportDecisionPoint {
  title: string;                    // Decision area (e.g., "State management approach")
  verdictTicketKey: string | null;  // Winning ticket key or null for ties
  verdictSummary: string;           // Why this ticket won this point
  rationale: string;                // Detailed reasoning
  approaches: Array<{
    ticketKey: string;              // Participant ticket key
    summary: string;                // How this ticket addressed the decision
  }>;
}
```

### ComparisonReport Extension

```typescript
interface ComparisonReport {
  // ... existing fields unchanged ...
  decisionPoints?: ReportDecisionPoint[];  // NEW optional field
}
```

## Data Flow

```
AI Output (ReportDecisionPoint[])
  → Zod validation (serializedComparisonReportSchema)
  → buildDecisionPoints() maps to Prisma input:
    - title → title
    - verdictTicketKey → verdictTicketId (resolved via ticketKeyToId map)
    - verdictSummary → verdictSummary
    - rationale → rationale
    - approaches[] → participantApproaches (with ticketId added from map)
    - array index → displayOrder
```

## Validation Rules

- `decisionPoints` is optional; absence or empty array triggers fallback
- `verdictTicketKey` must be `null` or exist in `participantTicketKeys`; invalid keys result in `verdictTicketId: null`
- `approaches[].ticketKey` must exist in `participantTicketKeys`; invalid entries are skipped
- No artificial cap on decision point count (AI typically produces 3-7)
