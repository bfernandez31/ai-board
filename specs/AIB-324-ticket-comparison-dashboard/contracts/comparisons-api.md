# API Contracts: Comparisons (AIB-324)

**Date**: 2026-03-20

## POST /api/projects/:projectId/comparisons

Save a new comparison after `/compare` command completes.

**Authentication**: Bearer workflow token
**Authorization**: Workflow token validation (same as job status updates)

### Request Body

```json
{
  "sourceTicketId": 42,
  "recommendation": "Ticket AIB-100 provides the most comprehensive implementation with superior test coverage and constitution compliance.",
  "notes": "Comparison of 3 implementations for the notification feature.",
  "entries": [
    {
      "ticketId": 42,
      "rank": 1,
      "score": 87.5,
      "isWinner": true,
      "keyDifferentiators": "Best test coverage (0.85 ratio), full constitution compliance, cleanest error handling",
      "linesAdded": 450,
      "linesRemoved": 30,
      "sourceFileCount": 12,
      "testFileCount": 8,
      "testRatio": 0.85,
      "complianceData": "{\"principles\":[{\"name\":\"TypeScript-First\",\"passed\":true,\"notes\":\"All types explicit\"},{\"name\":\"Security-First\",\"passed\":true,\"notes\":\"Zod validation on all inputs\"}]}"
    },
    {
      "ticketId": 43,
      "rank": 2,
      "score": 72.0,
      "isWinner": false,
      "keyDifferentiators": "Fastest implementation, minimal code changes",
      "linesAdded": 200,
      "linesRemoved": 10,
      "sourceFileCount": 6,
      "testFileCount": 2,
      "testRatio": 0.33,
      "complianceData": "{\"principles\":[{\"name\":\"TypeScript-First\",\"passed\":true,\"notes\":\"\"},{\"name\":\"Security-First\",\"passed\":false,\"notes\":\"Missing input validation on POST endpoint\"}]}"
    }
  ],
  "decisionPoints": [
    {
      "topic": "Error handling approach",
      "verdict": "Ticket AIB-100's try-catch with structured error responses is superior",
      "approaches": "{\"AIB-100\":{\"approach\":\"try-catch with Zod validation and structured error responses\",\"assessment\":\"Follows constitution error handling rules\"},\"AIB-101\":{\"approach\":\"Minimal error handling with generic catch\",\"assessment\":\"Missing structured error responses\"}}"
    }
  ]
}
```

### Zod Validation Schema

```typescript
const comparisonEntrySchema = z.object({
  ticketId: z.number().int().positive(),
  rank: z.number().int().positive(),
  score: z.number().min(0).max(100),
  isWinner: z.boolean(),
  keyDifferentiators: z.string().min(1),
  linesAdded: z.number().int().min(0),
  linesRemoved: z.number().int().min(0),
  sourceFileCount: z.number().int().min(0),
  testFileCount: z.number().int().min(0),
  testRatio: z.number().min(0).max(1),
  complianceData: z.string().min(1),
});

const comparisonDecisionPointSchema = z.object({
  topic: z.string().min(1),
  verdict: z.string().min(1),
  approaches: z.string().min(1),
});

const createComparisonSchema = z.object({
  sourceTicketId: z.number().int().positive(),
  recommendation: z.string().min(1),
  notes: z.string().optional(),
  entries: z.array(comparisonEntrySchema).min(2),
  decisionPoints: z.array(comparisonDecisionPointSchema).min(0),
});
```

### Response (201 Created)

```json
{
  "id": 1,
  "projectId": 5,
  "sourceTicketId": 42,
  "recommendation": "Ticket AIB-100 provides the most comprehensive implementation...",
  "notes": "Comparison of 3 implementations...",
  "createdAt": "2026-03-20T10:30:00.000Z",
  "entries": [
    {
      "id": 1,
      "ticketId": 42,
      "rank": 1,
      "score": 87.5,
      "isWinner": true
    },
    {
      "id": 2,
      "ticketId": 43,
      "rank": 2,
      "score": 72.0,
      "isWinner": false
    }
  ]
}
```

### Error Responses

- **400 Bad Request**: Invalid payload (Zod validation failure)
- **401 Unauthorized**: Missing or invalid Bearer token
- **404 Not Found**: Project or ticket not found
- **422 Unprocessable Entity**: Business rule violation (e.g., tickets not in same project, no winner marked)

---

## GET /api/projects/:projectId/comparisons

List all comparisons for a project (DB-backed).

**Authentication**: Required (session)
**Authorization**: Owner OR member

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | int | 20 | Max results (1-50) |
| offset | int | 0 | Pagination offset |

### Response (200 OK)

```json
{
  "comparisons": [
    {
      "id": 1,
      "sourceTicketId": 42,
      "sourceTicketKey": "AIB-100",
      "recommendation": "Ticket AIB-100 provides the most comprehensive implementation...",
      "createdAt": "2026-03-20T10:30:00.000Z",
      "entryCount": 3,
      "winnerTicketKey": "AIB-100",
      "winnerScore": 87.5
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

---

## GET /api/projects/:projectId/comparisons/:comparisonId

Get full comparison with enriched data (ticket metadata, telemetry, quality scores).

**Authentication**: Required (session)
**Authorization**: Owner OR member

### Response (200 OK)

```json
{
  "id": 1,
  "projectId": 5,
  "sourceTicketKey": "AIB-100",
  "recommendation": "Ticket AIB-100 provides the most comprehensive implementation...",
  "notes": "Comparison of 3 implementations...",
  "createdAt": "2026-03-20T10:30:00.000Z",
  "entries": [
    {
      "id": 1,
      "rank": 1,
      "score": 87.5,
      "isWinner": true,
      "keyDifferentiators": "Best test coverage...",
      "metrics": {
        "linesAdded": 450,
        "linesRemoved": 30,
        "sourceFileCount": 12,
        "testFileCount": 8,
        "testRatio": 0.85
      },
      "complianceData": [
        { "name": "TypeScript-First", "passed": true, "notes": "All types explicit" },
        { "name": "Security-First", "passed": true, "notes": "Zod validation on all inputs" }
      ],
      "ticket": {
        "id": 42,
        "ticketKey": "AIB-100",
        "title": "Notification system implementation",
        "stage": "SHIP",
        "workflowType": "FULL",
        "branch": "AIB-100-notification-system"
      },
      "telemetry": {
        "totalCostUsd": 1.25,
        "totalDurationMs": 45000,
        "totalInputTokens": 150000,
        "totalOutputTokens": 30000,
        "model": "opus"
      },
      "qualityScore": {
        "score": 85,
        "details": { "dimensions": [] }
      }
    }
  ],
  "decisionPoints": [
    {
      "id": 1,
      "topic": "Error handling approach",
      "verdict": "Ticket AIB-100's try-catch with structured error responses is superior",
      "approaches": {
        "AIB-100": {
          "approach": "try-catch with Zod validation and structured error responses",
          "assessment": "Follows constitution error handling rules"
        },
        "AIB-101": {
          "approach": "Minimal error handling with generic catch",
          "assessment": "Missing structured error responses"
        }
      }
    }
  ]
}
```

**Enrichment Notes**:
- `ticket`: From Ticket table (id, ticketKey, title, stage, workflowType, branch)
- `telemetry`: Aggregated from Job table (sum of costUsd, durationMs, tokens for COMPLETED jobs)
- `qualityScore`: From latest COMPLETED verify Job's qualityScore/qualityScoreDetails fields
- Missing quality score → `qualityScore: null` (UI shows "Pending")
- Missing telemetry → `telemetry: null` (UI shows "N/A")

---

## GET /api/projects/:projectId/tickets/:ticketId/comparisons/db

List all comparisons a specific ticket participates in (DB-backed).

**Authentication**: Required (session)
**Authorization**: Owner OR member

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | int | 20 | Max results (1-50) |
| offset | int | 0 | Pagination offset |

### Response (200 OK)

```json
{
  "comparisons": [
    {
      "id": 1,
      "sourceTicketKey": "AIB-100",
      "recommendation": "Ticket AIB-100 provides...",
      "createdAt": "2026-03-20T10:30:00.000Z",
      "entryCount": 3,
      "ticketRank": 1,
      "ticketScore": 87.5,
      "ticketIsWinner": true,
      "winnerTicketKey": "AIB-100"
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}
```

---

## GET /api/projects/:projectId/tickets/:ticketId/comparisons/db/check

Lightweight check if a ticket has DB-backed comparisons (for conditional tab rendering).

**Authentication**: Required (session)
**Authorization**: Owner OR member

### Response (200 OK)

```json
{
  "hasComparisons": true,
  "count": 2
}
```
