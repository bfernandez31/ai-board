# API Contracts: Fix Display Closed Ticket Modal

**Feature Branch**: `AIB-156-fix-display-closed`
**Date**: 2026-01-07

## Overview

This feature uses existing API endpoints. No new endpoints are required. The existing ticket endpoint already supports lookup by ticket key.

## Existing Endpoint (Used by This Feature)

### GET /api/projects/{projectId}/tickets/{identifier}

**Description**: Fetch a single ticket by numeric ID or ticket key.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| projectId | number | Project ID |
| identifier | string | Ticket ID (numeric) OR ticket key (e.g., "AIB-123") |

**Authentication**: Required (session-based via NextAuth.js)

**Authorization**: User must be project owner OR member

**Response Codes**:
| Code | Description |
|------|-------------|
| 200 | Success - ticket found |
| 400 | Invalid project ID format |
| 401 | Unauthorized - no session |
| 403 | Forbidden - ticket belongs to different project |
| 404 | Project or ticket not found |
| 500 | Internal server error |

**Success Response (200)**:
```json
{
  "id": 156,
  "ticketNumber": 156,
  "ticketKey": "AIB-156",
  "title": "Fix display closed ticket modal",
  "description": "When we search for a closed ticket...",
  "stage": "CLOSED",
  "version": 3,
  "projectId": 1,
  "branch": "156-fix-display-closed",
  "previewUrl": null,
  "autoMode": false,
  "clarificationPolicy": null,
  "workflowType": "FULL",
  "attachments": [],
  "createdAt": "2026-01-07T10:00:00.000Z",
  "updatedAt": "2026-01-07T12:00:00.000Z",
  "project": {
    "id": 1,
    "name": "AI Board",
    "clarificationPolicy": "AUTO",
    "githubOwner": "bfernandez31",
    "githubRepo": "ai-board"
  }
}
```

**Error Response (404)**:
```json
{
  "error": "Ticket not found"
}
```

**Error Response (401)**:
```json
{
  "error": "Unauthorized",
  "code": "AUTH_ERROR"
}
```

## TypeScript Types

### Request Types

```typescript
// Path parameter types
interface TicketByKeyParams {
  projectId: number;
  ticketKey: string;  // Format: "{PROJECT_KEY}-{NUMBER}"
}
```

### Response Types

```typescript
// Existing type - no changes needed
interface TicketWithVersion {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string | null;
  stage: Stage;
  version: number;
  projectId: number;
  branch: string | null;
  previewUrl: string | null;
  autoMode: boolean;
  clarificationPolicy: ClarificationPolicy | null;
  workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  attachments: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: number;
    name: string;
    clarificationPolicy: ClarificationPolicy;
    githubOwner?: string;
    githubRepo?: string;
  };
}
```

## Client-Side Hook Contract

### useTicketByKey

**Location**: `app/lib/hooks/queries/useTickets.ts`

**Signature**:
```typescript
function useTicketByKey(
  projectId: number,
  ticketKey: string | null,
  enabled?: boolean
): UseQueryResult<TicketWithVersion | null, Error>
```

**Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| projectId | number | required | Project ID |
| ticketKey | string \| null | required | Ticket key (e.g., "AIB-123") or null |
| enabled | boolean | true | Whether to execute the query |

**Returns**:
| Field | Type | Description |
|-------|------|-------------|
| data | TicketWithVersion \| null | Ticket data or null if not found |
| isLoading | boolean | Query in progress |
| isError | boolean | Query failed |
| error | Error \| null | Error details |
| refetch | () => void | Manual refetch trigger |

**Behavior**:
- Query is disabled when `ticketKey` is null
- Returns `null` for 404 responses (ticket not found)
- Throws error for other non-OK responses
- Uses same caching parameters as other ticket hooks (5s stale, 10m gc)

**Query Key**:
```typescript
['projects', projectId, 'tickets', 'by-key', ticketKey]
```

## URL Parameter Contract

### Modal Opening Parameters

**URL Format**: `?ticket={ticketKey}&modal=open&tab={tab}`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| ticket | string | Yes | Ticket key (e.g., "AIB-156") |
| modal | "open" | Yes | Must be "open" to trigger modal |
| tab | string | No | Default "details". Options: "details", "comments", "files" |

**Example**:
```
/projects/1/board?ticket=AIB-156&modal=open&tab=details
```

**Behavior**:
1. Board component detects `modal=open` and `ticket` params
2. First checks if ticket exists in `allTickets` (board state)
3. If not found, triggers `useTicketByKey` to fetch from API
4. Opens modal with fetched ticket data
5. Immediately cleans URL params to prevent re-open on close

## Search Integration (Existing)

### Search Result Click

**Location**: `components/search/ticket-search.tsx`

**Flow**:
1. User clicks search result (including closed tickets)
2. Handler sets URL params: `?ticket=${ticketKey}&modal=open`
3. Navigation triggers board's URL param handler
4. Board opens modal (using new fallback fetch for closed tickets)

No changes to search component required - existing URL param mechanism works.
