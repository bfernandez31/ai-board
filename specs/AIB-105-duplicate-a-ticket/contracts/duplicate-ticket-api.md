# API Contract: Duplicate Ticket

**Date**: 2025-12-11
**Feature**: AIB-105-duplicate-a-ticket

## Endpoint

```
POST /api/projects/{projectId}/tickets/{ticketId}/duplicate
```

## Description

Creates a duplicate of the specified ticket in the INBOX stage. The new ticket inherits the title (with "Copy of " prefix), description, clarification policy, and image attachments from the source ticket.

## Authentication

- Requires authenticated session (NextAuth.js)
- User must have access to the project (owner OR member)

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | integer | ✅ | The project containing the source ticket |
| ticketId | integer | ✅ | The source ticket to duplicate |

## Request

**Headers**:
```
Content-Type: application/json (optional, no body required)
Cookie: [session cookie]
```

**Body**: None required

## Response

### Success (201 Created)

```json
{
  "id": 42,
  "ticketNumber": 106,
  "ticketKey": "AIB-106",
  "title": "Copy of Original Ticket Title",
  "description": "The full description from the original ticket...",
  "stage": "INBOX",
  "version": 1,
  "projectId": 1,
  "branch": null,
  "previewUrl": null,
  "autoMode": false,
  "workflowType": "FULL",
  "clarificationPolicy": "PRAGMATIC",
  "attachments": [
    {
      "type": "uploaded",
      "url": "https://res.cloudinary.com/.../image.png",
      "filename": "screenshot.png",
      "mimeType": "image/png",
      "sizeBytes": 102400,
      "uploadedAt": "2025-12-10T10:00:00.000Z",
      "cloudinaryPublicId": "ai-board/tickets/41/screenshot"
    }
  ],
  "createdAt": "2025-12-11T14:30:00.000Z",
  "updatedAt": "2025-12-11T14:30:00.000Z"
}
```

### Error Responses

#### 400 Bad Request - Invalid Project ID

```json
{
  "error": "Invalid project ID",
  "code": "VALIDATION_ERROR"
}
```

#### 400 Bad Request - Invalid Ticket ID

```json
{
  "error": "Invalid ticket ID",
  "code": "VALIDATION_ERROR"
}
```

#### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "code": "AUTH_ERROR"
}
```

#### 404 Not Found - Project

```json
{
  "error": "Project not found",
  "code": "PROJECT_NOT_FOUND"
}
```

#### 404 Not Found - Ticket

```json
{
  "error": "Ticket not found",
  "code": "TICKET_NOT_FOUND"
}
```

#### 500 Internal Server Error

```json
{
  "error": "Failed to duplicate ticket",
  "code": "DATABASE_ERROR"
}
```

## Business Logic

1. **Validate** projectId and ticketId are valid integers
2. **Authorize** user has access to project via `verifyProjectAccess(projectId)`
3. **Fetch** source ticket from database
4. **Verify** ticket belongs to specified project
5. **Generate** duplicate title:
   - Prefix with "Copy of "
   - Truncate if result exceeds 100 characters
6. **Copy** fields:
   - title (modified with prefix)
   - description (exact copy)
   - clarificationPolicy (exact copy or null)
   - attachments (exact copy of JSON array)
7. **Create** new ticket via `createTicket()`:
   - stage = INBOX
   - workflowType = FULL
   - branch = null
   - autoMode = false
8. **Return** created ticket with 201 status

## Title Truncation Algorithm

```typescript
function createDuplicateTitle(originalTitle: string): string {
  const PREFIX = 'Copy of ';
  const MAX_LENGTH = 100;
  const maxOriginalLength = MAX_LENGTH - PREFIX.length; // 92 chars

  const truncatedTitle = originalTitle.length > maxOriginalLength
    ? originalTitle.slice(0, maxOriginalLength)
    : originalTitle;

  return `${PREFIX}${truncatedTitle}`;
}
```

**Examples**:
| Original Title | Result |
|---------------|--------|
| "Fix login bug" | "Copy of Fix login bug" |
| "A very long title that exceeds..." (95 chars) | "Copy of A very long title that exceeds..." (truncated to 100 chars) |

## Rate Limiting

None specific to this endpoint. Standard API rate limits apply.

## Caching

No caching. Each duplicate creates a new unique ticket.

## Idempotency

Not idempotent. Each call creates a new ticket. Multiple calls create multiple duplicates.
