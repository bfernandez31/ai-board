# Authentication Integration Contract

**Feature Branch**: `AIB-173-personal-access-tokens`
**Date**: 2026-01-23

## Bearer Token Authentication

### Request Format

All API endpoints accept Personal Access Tokens via the `Authorization` header:

```http
GET /api/projects HTTP/1.1
Host: ai-board.example.com
Authorization: Bearer pat_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz5678
```

### Token Format

```
pat_<64-hex-characters>
```

- **Prefix**: `pat_` (Personal Access Token)
- **Entropy**: 64 hexadecimal characters (32 bytes / 256 bits)
- **Total length**: 68 characters

### Authentication Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Client    │───►│   Route Handler │───►│  Token Lookup   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                      │
                              │                      ▼
                              │               ┌─────────────────┐
                              │               │  Hash Verify    │
                              │               └─────────────────┘
                              │                      │
                              ▼                      ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Session Fallback│◄───│ Return User ID  │
                       └─────────────────┘    └─────────────────┘
```

### Response Codes

| Code | Meaning | When |
|------|---------|------|
| 200/2xx | Success | Valid token or session |
| 401 | Unauthorized | Invalid, missing, or revoked token (and no valid session) |
| 429 | Rate Limited | Too many requests from IP |

### Error Response Format

```json
{
  "error": "Unauthorized"
}
```

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

---

## Session Fallback

When no `Authorization: Bearer` header is present, or when the token is invalid:

1. Route handler checks for valid NextAuth.js session cookie
2. If session exists, request proceeds with session user
3. If no session, returns 401 Unauthorized

This ensures backward compatibility with existing session-based authentication.

---

## Rate Limiting

### Limits

| Endpoint | Limit | Window | Identifier |
|----------|-------|--------|------------|
| Token validation (all API endpoints) | 60 | 1 minute | IP address |
| Token creation | 10 | 1 minute | User ID |
| Token deletion | 10 | 1 minute | User ID |

### Headers

Rate limit responses include standard headers:

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1706012460
Retry-After: 60
```

---

## Integration Helper: getCurrentUserOrToken

### Signature

```typescript
async function getCurrentUserOrToken(
  request: NextRequest
): Promise<{ id: string; email: string; name?: string | null }>
```

### Behavior

1. Check for `Authorization: Bearer pat_...` header
2. If present, validate token and return token owner's user
3. If invalid token, throw `Unauthorized` error
4. If no token, fall back to `getCurrentUser()` (session-based)

### Usage in Route Handlers

```typescript
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserOrToken(request);
    // User is authenticated via token OR session
    const projects = await getProjectsForUser(user.id);
    return NextResponse.json({ projects });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }
}
```

---

## lastUsedAt Updates

When a token is successfully used for authentication:

1. Token record's `lastUsedAt` is updated to current timestamp
2. Update is non-blocking (fire-and-forget)
3. Update failures do not affect request processing

---

## Supported Endpoints

All existing API endpoints support token authentication:

| Endpoint | Methods | Notes |
|----------|---------|-------|
| `/api/projects` | GET, POST | List/create projects |
| `/api/projects/{id}` | GET, PATCH, DELETE | Project CRUD |
| `/api/projects/{id}/tickets` | GET, POST | List/create tickets |
| `/api/projects/{id}/tickets/{id}` | GET, PATCH, DELETE | Ticket CRUD |
| ... | ... | All other API endpoints |

### Excluded Endpoints

| Endpoint | Reason |
|----------|--------|
| `/api/auth/*` | Authentication endpoints (session management) |
| `/api/tokens/*` | Token management (requires session, not token) |
| `/api/jobs/{id}/status` | Uses workflow token, not user token |
