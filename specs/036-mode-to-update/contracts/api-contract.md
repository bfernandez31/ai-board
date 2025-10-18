# API Contract: Documentation Edit Mode

**Feature**: 036-mode-to-update
**Version**: 1.0.0
**Date**: 2025-10-18

## Overview

This document defines the REST API contract for editing documentation files (spec.md, plan.md, tasks.md) within ticket feature branches.

---

## POST /api/projects/:projectId/docs

Commits and pushes edited documentation content to the ticket's feature branch.

### Request

**Endpoint**: `POST /api/projects/:projectId/docs`

**Path Parameters**:
- `projectId` (integer, required): The project ID owning the ticket

**Headers**:
- `Content-Type: application/json`
- `Cookie: next-auth.session-token=...` (required, session authentication)

**Body** (application/json):

```typescript
{
  ticketId: number;           // Ticket ID (must belong to projectId)
  docType: 'spec' | 'plan' | 'tasks';  // Which document to edit
  content: string;            // New markdown content (max 1MB)
  commitMessage?: string;     // Optional custom commit message
}
```

**Example Request**:

```json
{
  "ticketId": 42,
  "docType": "spec",
  "content": "# Feature Specification: Updated Title\n\n## Summary\n\nUpdated content here...",
  "commitMessage": "docs: clarify user scenarios in spec"
}
```

### Response

#### Success (200 OK)

```typescript
{
  success: true;
  commitSha: string;           // Git commit hash (40 chars hex)
  updatedAt: string;           // ISO 8601 timestamp
  message: string;             // Success message for toast notification
}
```

**Example Response**:

```json
{
  "success": true,
  "commitSha": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
  "updatedAt": "2025-10-18T14:32:17.456Z",
  "message": "Specification updated successfully"
}
```

#### Errors

**400 Bad Request** - Invalid request body

```json
{
  "success": false,
  "error": "Validation error: content exceeds 1MB limit",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "content",
    "constraint": "max_length_1048576"
  }
}
```

**403 Forbidden** - Permission denied

```json
{
  "success": false,
  "error": "Cannot edit spec.md: ticket is in PLAN stage (spec editing only allowed in SPECIFY stage)",
  "code": "PERMISSION_DENIED"
}
```

**404 Not Found** - Resource not found

```json
{
  "success": false,
  "error": "Branch not found for ticket #42",
  "code": "BRANCH_NOT_FOUND"
}
```

**409 Conflict** - Merge conflict

```json
{
  "success": false,
  "error": "Unable to save: another user has modified this file. Please refresh and try again.",
  "code": "MERGE_CONFLICT"
}
```

**500 Internal Server Error** - Git operation failed

```json
{
  "success": false,
  "error": "Failed to push changes to remote repository",
  "code": "NETWORK_ERROR",
  "details": "Push failed: connection timeout"
}
```

**504 Gateway Timeout** - Operation exceeded time limit

```json
{
  "success": false,
  "error": "Save operation timed out. Please try again.",
  "code": "TIMEOUT"
}
```

### Validation Rules

#### Request Validation

- `projectId`: Must be a positive integer, must exist in database
- `ticketId`: Must be a positive integer, must belong to `projectId`
- `docType`: Must be one of: `"spec"`, `"plan"`, `"tasks"`
- `content`: Must be a string, max length 1,048,576 characters (1MB)
- `commitMessage`: Optional string, max length 500 characters

#### Permission Validation

- User must be authenticated (valid session cookie)
- User must own the project (Project.userId === session.userId)
- Ticket's `branch` field must not be null
- Document type must be allowed for current ticket stage:
  - SPECIFY stage: Only `spec` allowed
  - PLAN stage: Only `plan` and `tasks` allowed
  - Other stages: No editing allowed (403 Forbidden)

#### Content Validation

- Content must be valid markdown (parseable by remark)
- Content must not be empty string (min length: 1 character)
- Content must not exceed 1MB size limit

#### Git Validation

- Branch must exist in repository (`git rev-parse --verify origin/{branch}`)
- Git push must succeed (no merge conflicts, network available)

### Authorization

**Authentication**: Session-based (NextAuth.js)

**Authorization Logic**:

```typescript
// 1. Verify user is authenticated
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

// 2. Verify user owns project
const project = await prisma.project.findUnique({ where: { id: projectId } });
if (project.userId !== session.user.id) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}

// 3. Verify stage-based permissions
const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
if (!canEdit(ticket.stage, docType)) {
  return Response.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 });
}
```

### Performance Characteristics

**Expected Response Times**:
- Fast path (no git operation): <200ms
- Typical save (commit + push): <2 seconds
- Timeout limit: 10 seconds (Vercel function limit)

**Rate Limiting**:
- 10 requests per minute per user
- 429 Too Many Requests response if exceeded

**Concurrency**:
- Last-write-wins strategy
- Merge conflicts return 409 status (no automatic resolution)

### Idempotency

This endpoint is **NOT idempotent**. Each request creates a new git commit, even if the content is identical to a previous request.

**Recommendation**: Clients should debounce save requests and track dirty state to avoid unnecessary commits.

### Error Codes

| Code | HTTP Status | Description | User Action |
|------|-------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request body or content | Fix validation errors and retry |
| `PERMISSION_DENIED` | 403 | User lacks permission for this operation | Check ticket stage and permissions |
| `BRANCH_NOT_FOUND` | 404 | Ticket's branch doesn't exist | Contact admin or create branch |
| `MERGE_CONFLICT` | 409 | Concurrent edit detected | Refresh page and retry with latest content |
| `NETWORK_ERROR` | 500 | Git push failed | Check network connectivity, retry |
| `TIMEOUT` | 504 | Operation exceeded time limit | Retry operation |

---

## Security Considerations

### Input Sanitization

- Commit messages sanitized to prevent shell injection
- File paths validated to prevent directory traversal
- Content validated to prevent binary/malicious files

### Authentication

- All requests require valid session cookie
- Session validated against database (NextAuth.js)
- Expired sessions return 401 Unauthorized

### Authorization

- Project ownership verified (userId match)
- Ticket ownership verified (projectId match)
- Stage-based permissions enforced

### Rate Limiting

- 10 requests per minute per user (IP + userId)
- Prevents DoS attacks via git operations
- Returns 429 with Retry-After header

### Git Security

- No user-supplied paths (only predefined file locations)
- Commit author forced to authenticated user
- No execution of arbitrary git commands

---

## Testing Contract

### Contract Tests

```typescript
describe('POST /api/projects/:projectId/docs contract', () => {
  test('returns 200 with valid request', async () => {
    const response = await request.post('/api/projects/1/docs', {
      ticketId: 42,
      docType: 'spec',
      content: '# Updated spec\n\nContent here',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      commitSha: expect.stringMatching(/^[a-f0-9]{40}$/),
      updatedAt: expect.any(String),
      message: expect.any(String),
    });
  });

  test('returns 400 for content exceeding 1MB', async () => {
    const largeContent = 'x'.repeat(1048577);

    const response = await request.post('/api/projects/1/docs', {
      ticketId: 42,
      docType: 'spec',
      content: largeContent,
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 403 for wrong stage permissions', async () => {
    // Ticket in PLAN stage trying to edit spec
    const response = await request.post('/api/projects/1/docs', {
      ticketId: 42,  // Ticket in PLAN stage
      docType: 'spec',
      content: '# Updated',
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('PERMISSION_DENIED');
  });

  test('returns 404 for missing branch', async () => {
    // Ticket with branch = null
    const response = await request.post('/api/projects/1/docs', {
      ticketId: 99,
      docType: 'spec',
      content: '# Updated',
    });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('BRANCH_NOT_FOUND');
  });
});
```

---

## Changelog

### Version 1.0.0 (2025-10-18)

- Initial API contract definition
- POST /api/projects/:projectId/docs endpoint
- Stage-based permission model
- Error code standardization
