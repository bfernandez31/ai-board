# API Contract: Ticket Search (Existing)

**Endpoint**: `GET /api/projects/[projectId]/tickets/search`

**Status**: Existing endpoint—no changes required for this feature.

## Request

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | number | Yes | Project ID to search within |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | - | Search query (min 2 characters) |
| `limit` | number | 10 | Max results (max 50) |

### Headers

| Header | Value | Description |
|--------|-------|-------------|
| `Cookie` | session | Session auth (UI) |
| `Authorization` | Bearer {token} | Workflow auth (optional) |

## Response

### Success (200 OK)

```typescript
interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
}

interface SearchResult {
  id: number;
  ticketKey: string;
  title: string;
  stage: string;
}
```

**Example**:
```json
{
  "results": [
    {
      "id": 141,
      "ticketKey": "AIB-141",
      "title": "Comment with ticket and command autocomplete",
      "stage": "BUILD"
    },
    {
      "id": 140,
      "ticketKey": "AIB-140",
      "title": "Cleanup command improvements",
      "stage": "SHIP"
    }
  ],
  "totalCount": 2
}
```

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | - | Query must be at least 2 characters |
| 401 | - | Unauthorized |
| 403 | - | Access denied (not project member) |
| 404 | - | Project not found |

## Notes for Autocomplete

1. **Relevance Sorting**: API sorts by:
   - Exact key match (score 4)
   - Key contains query (score 3)
   - Title contains query (score 2)
   - Description match (score 1)

2. **2-Character Minimum**: API requires `q.length >= 2`. For single-character search in UI, either:
   - Show recent tickets without search
   - Wait for 2nd character

3. **Case Insensitive**: Search is case-insensitive for key, title, and description.
