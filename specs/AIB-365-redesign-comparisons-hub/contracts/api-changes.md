# API Contract Changes: Redesign Comparisons Hub

**Feature Branch**: `AIB-365-redesign-comparisons-hub`
**Date**: 2026-03-27

## Summary

No new API endpoints. One minor response field addition to the existing paginated list endpoint.

---

## Modified Endpoint: GET /api/projects/:projectId/comparisons

### Change

Add `winnerScore` field to each comparison summary in the response.

### Request (unchanged)

```
GET /api/projects/:projectId/comparisons?page=1&pageSize=10
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| page | integer | No | 1 | Page number (1-indexed) |
| pageSize | integer | No | 10 | Items per page (max 50) |

### Response (updated)

```json
{
  "comparisons": [
    {
      "id": 42,
      "generatedAt": "2026-03-25T14:30:00.000Z",
      "sourceTicketId": 10,
      "sourceTicketKey": "AIB-100",
      "participantTicketIds": [11, 12, 13],
      "participantTicketKeys": ["AIB-101", "AIB-102", "AIB-103"],
      "winnerTicketId": 11,
      "winnerTicketKey": "AIB-101",
      "winnerTicketTitle": "Implement feature X with optimized approach",
      "winnerScore": 87.5,
      "summary": "AIB-101 demonstrated superior code quality...",
      "recommendation": "Proceed with AIB-101 implementation",
      "overallRecommendation": "Proceed with AIB-101 implementation",
      "keyDifferentiators": ["Better test coverage", "Lower cost"],
      "markdownPath": "/comparisons/AIB-100/comparison-42.md"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 25,
  "totalPages": 3
}
```

### New Field

| Field | Type | Description |
|-------|------|-------------|
| `winnerScore` | `number \| null` | The winner participant's comparison score. Null if score was not recorded. |

---

## Client-Side Pagination Contract

The client switches from page-replacement to page-accumulation:

**Before**: `useProjectComparisonList(projectId, page, pageSize)` — fetches a single page, replaces previous data.

**After**: `useProjectComparisonListInfinite(projectId, pageSize)` — uses `useInfiniteQuery` to accumulate pages. The API contract is identical; only the client consumption pattern changes.

### Infinite Query Key

```typescript
// Old: ['comparisons', projectId, 'project-history', page, pageSize]
// New: ['comparisons', projectId, 'project-history-infinite', pageSize]
```

### getNextPageParam

```typescript
(lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined
```

---

## No Other Endpoint Changes

The following endpoints remain completely unchanged:
- `GET /api/projects/:projectId/comparisons/:comparisonId` — full detail (used when card is expanded)
- `GET /api/projects/:projectId/comparisons/candidates` — VERIFY stage candidates
- `POST /api/projects/:projectId/comparisons/launch` — launch new comparison
- `GET /api/projects/:projectId/jobs/status` — poll pending job statuses
