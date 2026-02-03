# API Contract: Ticket Description Update

**Feature Branch**: `AIB-209-increase-ticket-description`

## Affected Endpoints

### POST /api/projects/:projectId/tickets

**Change**: Description field max length increased from 2500 to 10000 characters.

**Request Body** (unchanged format):
```json
{
  "title": "string (max 100 chars)",
  "description": "string (max 10000 chars)",  // ← LIMIT INCREASED
  "clarificationPolicy": "AUTO | CONSERVATIVE | PRAGMATIC | null"
}
```

**Validation Error** (updated message):
```json
{
  "error": "Validation failed",
  "details": {
    "fieldErrors": {
      "description": ["Description must be 10000 characters or less"]
    }
  }
}
```

### PATCH /api/projects/:projectId/tickets/:ticketId

**Change**: Description field max length increased from 2500 to 10000 characters.

**Request Body** (unchanged format):
```json
{
  "description": "string (max 10000 chars)",  // ← LIMIT INCREASED
  "version": "number"
}
```

### GET /api/projects/:projectId/tickets/:ticketId

**Response Body** (unchanged format, but description can now be longer):
```json
{
  "id": 1,
  "ticketKey": "ABC-123",
  "title": "...",
  "description": "string (up to 10000 chars)",  // ← CAN BE LONGER
  // ... other fields unchanged
}
```

## Breaking Changes

**None.** This is a non-breaking change:
- Existing clients sending descriptions under 2500 chars will continue to work
- Clients can now send longer descriptions up to 10000 chars
- Response format unchanged
