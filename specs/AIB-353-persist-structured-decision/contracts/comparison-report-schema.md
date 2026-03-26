# Contract: Comparison Report Schema Extension

## Endpoint

`POST /api/projects/{projectId}/tickets/{id}/comparisons`

No endpoint changes — the request body schema is extended with an optional field.

## Request Body Extension

The `report` object in the persistence request gains an optional `decisionPoints` array:

```json
{
  "compareRunKey": "cmp_...",
  "projectId": 1,
  "sourceTicketKey": "AIB-100",
  "participantTicketKeys": ["AIB-100", "AIB-101"],
  "markdownPath": "specs/AIB-100/comparisons/...",
  "report": {
    "metadata": { "..." },
    "summary": "...",
    "alignment": { "..." },
    "implementation": { "..." },
    "compliance": { "..." },
    "recommendation": "...",
    "warnings": [],
    "decisionPoints": [
      {
        "title": "State management approach",
        "verdictTicketKey": "AIB-100",
        "verdictSummary": "AIB-100's approach is more maintainable",
        "rationale": "AIB-100 uses React context with a single reducer, while AIB-101 introduces a custom pub-sub system that adds complexity without clear benefit.",
        "approaches": [
          {
            "ticketKey": "AIB-100",
            "summary": "Uses React context with useReducer for centralized state management"
          },
          {
            "ticketKey": "AIB-101",
            "summary": "Implements a custom publish-subscribe event bus for state synchronization"
          }
        ]
      },
      {
        "title": "Error handling strategy",
        "verdictTicketKey": null,
        "verdictSummary": "Both approaches are equally robust",
        "rationale": "Both tickets implement comprehensive try-catch blocks with structured error responses. Neither has a clear advantage.",
        "approaches": [
          {
            "ticketKey": "AIB-100",
            "summary": "Uses Zod validation with custom error formatter"
          },
          {
            "ticketKey": "AIB-101",
            "summary": "Uses Zod validation with middleware error handler"
          }
        ]
      }
    ]
  }
}
```

## Zod Schema Addition

```typescript
const reportDecisionPointSchema = z.object({
  title: z.string().min(1),
  verdictTicketKey: z.string().nullable(),
  verdictSummary: z.string().min(1),
  rationale: z.string().min(1),
  approaches: z.array(z.object({
    ticketKey: z.string().min(1),
    summary: z.string().min(1),
  })),
});

// Added to serializedComparisonReportSchema:
decisionPoints: z.array(reportDecisionPointSchema).optional().default([])
```

## Response

No changes to response schema. Existing response:

```json
{
  "comparisonId": 42,
  "compareRunKey": "cmp_...",
  "status": "created"
}
```

## Backward Compatibility

- `decisionPoints` is optional with a default of `[]`
- When absent or empty: fallback to existing `matchingRequirements`-based derivation
- When present and non-empty: each entry maps directly to a `DecisionPointEvaluation` record
- No changes to existing API consumers
