# API Contract: Close Ticket

**Feature**: AIB-148-copy-of-close
**Date**: 2026-01-06

## Endpoint

```
POST /api/projects/{projectId}/tickets/{id}/close
```

## Description

Closes a ticket from VERIFY stage, transitioning it to CLOSED terminal state. Closes associated GitHub PRs with an explanatory comment but preserves the git branch for future reference.

## Authentication

- Requires authenticated session (NextAuth.js)
- User must be project owner or member

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | integer | Yes | Project ID |
| id | integer | Yes | Ticket ID |

## Request Body

```typescript
interface CloseTicketRequest {
  // Empty body - all data comes from path params and database
}
```

## Response

### Success (200 OK)

```typescript
interface CloseTicketResponse {
  id: number;
  ticketKey: string;
  stage: 'CLOSED';
  closedAt: string; // ISO 8601 datetime
  version: number;
  prsClosed: number; // Number of GitHub PRs closed
}
```

**Example**:
```json
{
  "id": 148,
  "ticketKey": "AIB-148",
  "stage": "CLOSED",
  "closedAt": "2026-01-06T14:30:00.000Z",
  "version": 4,
  "prsClosed": 1
}
```

### Error Responses

#### 400 Bad Request - Invalid Stage

```json
{
  "error": "Can only close tickets in VERIFY stage",
  "code": "INVALID_STAGE"
}
```

#### 400 Bad Request - Active Jobs

```json
{
  "error": "Cannot close ticket with active jobs",
  "code": "ACTIVE_JOBS"
}
```

#### 401 Unauthorized

```json
{
  "error": "Authentication required"
}
```

#### 403 Forbidden

```json
{
  "error": "Not authorized to access this project"
}
```

#### 404 Not Found

```json
{
  "error": "Ticket not found"
}
```

#### 409 Conflict - Version Mismatch

```json
{
  "error": "Ticket was modified by another user. Please refresh and try again.",
  "code": "VERSION_CONFLICT"
}
```

#### 423 Locked - Cleanup In Progress

```json
{
  "error": "Project cleanup is in progress. Please wait for it to complete.",
  "code": "CLEANUP_LOCKED"
}
```

#### 500 Internal Server Error

```json
{
  "error": "Failed to close ticket",
  "details": "..." // Optional error details
}
```

## Side Effects

1. **Database Updates**:
   - `ticket.stage` → `CLOSED`
   - `ticket.closedAt` → current timestamp
   - `ticket.version` → increment by 1

2. **GitHub Operations** (best-effort):
   - Find all open PRs with matching head branch
   - Close each PR with comment: "Closed by ai-board - ticket moved to CLOSED state"
   - Branch is NOT deleted (preserved for reference)

3. **Cache Invalidation**:
   - Ticket query cache invalidated
   - Board tickets refetched

## Idempotency

- If GitHub PRs are already closed, operation succeeds (idempotent)
- If ticket is already CLOSED, returns 400 with INVALID_STAGE error

## Rate Limiting

- Subject to standard API rate limits
- GitHub API calls subject to GitHub rate limits (5000/hour for authenticated requests)

## OpenAPI Specification

```yaml
openapi: 3.0.3
info:
  title: AI-Board Close Ticket API
  version: 1.0.0

paths:
  /api/projects/{projectId}/tickets/{id}/close:
    post:
      summary: Close a ticket from VERIFY stage
      description: |
        Transitions a ticket to CLOSED terminal state.
        Closes associated GitHub PRs but preserves the branch.
      tags:
        - Tickets
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: integer
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: Ticket closed successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: integer
                  ticketKey:
                    type: string
                  stage:
                    type: string
                    enum: [CLOSED]
                  closedAt:
                    type: string
                    format: date-time
                  version:
                    type: integer
                  prsClosed:
                    type: integer
        '400':
          description: Invalid request (wrong stage, active jobs)
        '401':
          description: Authentication required
        '403':
          description: Not authorized
        '404':
          description: Ticket not found
        '409':
          description: Version conflict
        '423':
          description: Project cleanup in progress
        '500':
          description: Server error
```
