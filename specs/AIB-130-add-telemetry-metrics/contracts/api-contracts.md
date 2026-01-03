# API Contracts: Telemetry Metrics for Ticket Comparison

This feature uses **existing API endpoints only**. No new endpoints are created.

## Existing Endpoints Used

### 1. Search Tickets

**Endpoint**: `GET /api/projects/{projectId}/tickets/search`

**Purpose**: Resolve ticket key to ticket ID

**Request**:
```http
GET /api/projects/3/tickets/search?q=AIB-127 HTTP/1.1
Host: app-url.com
Authorization: Bearer {WORKFLOW_API_TOKEN}
```

**Response** (200 OK):
```json
{
  "results": [
    {
      "id": 456,
      "ticketKey": "AIB-127",
      "title": "Add telemetry feature",
      "stage": "VERIFY"
    }
  ],
  "totalCount": 1
}
```

**Error Responses**:
- `400`: Query too short (< 2 chars)
- `401`: Unauthorized
- `403`: Access denied

### 2. Get Ticket Jobs

**Endpoint**: `GET /api/projects/{projectId}/tickets/{ticketId}/jobs`

**Purpose**: Fetch job telemetry data for aggregation

**Request**:
```http
GET /api/projects/3/tickets/456/jobs HTTP/1.1
Host: app-url.com
Authorization: Bearer {WORKFLOW_API_TOKEN}
```

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "command": "specify",
    "status": "COMPLETED",
    "startedAt": "2026-01-02T10:00:00.000Z",
    "completedAt": "2026-01-02T10:05:00.000Z",
    "inputTokens": 15000,
    "outputTokens": 8000,
    "cacheReadTokens": 3000,
    "cacheCreationTokens": 1000,
    "costUsd": 0.0456,
    "durationMs": 15000,
    "model": "claude-sonnet-4-5-20251101",
    "toolsUsed": ["Read", "Write", "Bash"]
  },
  {
    "id": 2,
    "command": "plan",
    "status": "COMPLETED",
    "startedAt": "2026-01-02T11:00:00.000Z",
    "completedAt": "2026-01-02T11:03:00.000Z",
    "inputTokens": 20000,
    "outputTokens": 10000,
    "cacheReadTokens": 5000,
    "cacheCreationTokens": 2000,
    "costUsd": 0.0567,
    "durationMs": 18000,
    "model": "claude-sonnet-4-5-20251101",
    "toolsUsed": ["Read", "Glob", "Grep"]
  }
]
```

**Error Responses**:
- `400`: Invalid project or ticket ID
- `403`: Ticket belongs to different project
- `404`: Project or ticket not found

## File Contracts

### Telemetry Context File

**Path**: `specs/$BRANCH/.telemetry-context.json`

**Schema**:
```typescript
interface TelemetryContextFile {
  /** ISO 8601 timestamp when file was generated */
  generatedAt: string;

  /** Telemetry data keyed by ticket key */
  tickets: {
    [ticketKey: string]: {
      ticketKey: string;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheCreationTokens: number;
      costUsd: number;
      durationMs: number;
      model: string | null;
      toolsUsed: string[];
      jobCount: number;
      hasData: boolean;
    };
  };
}
```

**Example**:
```json
{
  "generatedAt": "2026-01-03T14:30:00.000Z",
  "tickets": {
    "AIB-127": {
      "ticketKey": "AIB-127",
      "inputTokens": 35000,
      "outputTokens": 18000,
      "cacheReadTokens": 8000,
      "cacheCreationTokens": 3000,
      "costUsd": 0.1023,
      "durationMs": 33000,
      "model": "claude-sonnet-4-5-20251101",
      "toolsUsed": ["Edit", "Read", "Write", "Bash", "Glob", "Grep"],
      "jobCount": 2,
      "hasData": true
    },
    "AIB-128": {
      "ticketKey": "AIB-128",
      "inputTokens": 0,
      "outputTokens": 0,
      "cacheReadTokens": 0,
      "cacheCreationTokens": 0,
      "costUsd": 0,
      "durationMs": 0,
      "model": null,
      "toolsUsed": [],
      "jobCount": 0,
      "hasData": false
    }
  }
}
```

## Workflow Integration

### Environment Variables Available

| Variable | Description |
|----------|-------------|
| `APP_URL` | Base URL for API calls |
| `WORKFLOW_API_TOKEN` | Bearer token for authentication |
| `PROJECT_ID` | Current project ID |
| `BRANCH` | Current ticket branch (spec directory name) |

### API Call Pattern

```bash
# 1. Resolve ticket key to ID
SEARCH_RESULT=$(curl -s -H "Authorization: Bearer $WORKFLOW_API_TOKEN" \
  "${APP_URL}/api/projects/${PROJECT_ID}/tickets/search?q=AIB-127")

TICKET_ID=$(echo "$SEARCH_RESULT" | jq -r '.results[0].id')

# 2. Fetch jobs for ticket
JOBS=$(curl -s -H "Authorization: Bearer $WORKFLOW_API_TOKEN" \
  "${APP_URL}/api/projects/${PROJECT_ID}/tickets/${TICKET_ID}/jobs")

# 3. Aggregate telemetry (only COMPLETED jobs)
TELEMETRY=$(echo "$JOBS" | jq '{
  ticketKey: "AIB-127",
  inputTokens: [.[] | select(.status == "COMPLETED") | .inputTokens // 0] | add,
  outputTokens: [.[] | select(.status == "COMPLETED") | .outputTokens // 0] | add,
  cacheReadTokens: [.[] | select(.status == "COMPLETED") | .cacheReadTokens // 0] | add,
  cacheCreationTokens: [.[] | select(.status == "COMPLETED") | .cacheCreationTokens // 0] | add,
  costUsd: [.[] | select(.status == "COMPLETED") | .costUsd // 0] | add,
  durationMs: [.[] | select(.status == "COMPLETED") | .durationMs // 0] | add,
  model: [.[] | select(.status == "COMPLETED" and .model != null) | .model][0],
  toolsUsed: [.[] | select(.status == "COMPLETED") | .toolsUsed[]] | unique | sort,
  jobCount: [.[] | select(.status == "COMPLETED")] | length,
  hasData: ([.[] | select(.status == "COMPLETED") | .costUsd // 0] | add) > 0
}')
```

## Error Handling Contract

| Scenario | HTTP Status | Action |
|----------|-------------|--------|
| Ticket not found | 404 | Use empty telemetry (hasData: false) |
| API timeout | N/A | Retry once, then use empty telemetry |
| Invalid JSON response | N/A | Log warning, use empty telemetry |
| No completed jobs | 200 (empty array) | Use empty telemetry (hasData: false) |

The compare command MUST NOT fail due to telemetry unavailability. Graceful degradation is required.
