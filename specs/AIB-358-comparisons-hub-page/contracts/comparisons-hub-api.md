# API Contracts: Comparisons Hub Page

**Date**: 2026-03-27 | **Branch**: `AIB-358-comparisons-hub-page`

## Modified Endpoints

### GET `/api/projects/:projectId/comparisons`

**Change**: Rewrite to query from `ComparisonRecord` database table instead of filesystem scanning.

**Auth**: Session-based (NextAuth.js) — `verifyProjectAccess(projectId)`

**Query Parameters**:

| Param | Type | Default | Validation |
|-------|------|---------|------------|
| `limit` | number | 20 | 1–100, integer |
| `offset` | number | 0 | >= 0, integer |

**Response** `200 OK`:

```typescript
{
  comparisons: ProjectComparisonSummary[];
  total: number;
  limit: number;
  offset: number;
}
```

**`ProjectComparisonSummary` shape**:

```typescript
interface ProjectComparisonSummary {
  id: number;
  generatedAt: string;           // ISO 8601
  sourceTicketKey: string;
  sourceTicketTitle: string;
  winnerTicketKey: string;
  winnerTicketTitle: string;
  winnerScore: number;
  participantCount: number;
  participantTicketKeys: string[];
  summary: string;               // max 2000 chars
  keyDifferentiators: string[];
}
```

**Error Responses**:
- `400 Bad Request`: `{ error: "Invalid project ID" }` or `{ error: "Invalid query parameters" }`
- `401 Unauthorized`: `{ error: "Unauthorized" }`
- `500 Internal Server Error`: `{ error: "Internal server error" }`

---

### GET `/api/projects/:projectId/comparisons/:comparisonId`

**New endpoint** for fetching comparison detail at the project level (without requiring a ticket ID).

**Auth**: Session-based — `verifyProjectAccess(projectId)`

**Path Parameters**:
- `projectId`: number (project ID)
- `comparisonId`: number (comparison record ID)

**Response** `200 OK`:

```typescript
ComparisonDetail
// Reuses existing ComparisonDetail type from lib/types/comparison.ts
// Includes: participants, decisionPoints, complianceRows, enrichments
```

**Error Responses**:
- `400 Bad Request`: `{ error: "Invalid project ID" }` or `{ error: "Invalid comparison ID" }`
- `401 Unauthorized`: `{ error: "Unauthorized" }`
- `404 Not Found`: `{ error: "Comparison not found" }`
- `500 Internal Server Error`: `{ error: "Internal server error" }`

---

## New Endpoints

### POST `/api/projects/:projectId/comparisons/launch`

**Purpose**: Launch a new comparison by selecting VERIFY-stage tickets.

**Auth**: Session-based — `verifyProjectAccess(projectId)`

**Request Body** (Zod validated):

```typescript
{
  ticketIds: number[];   // min 2, max 5 — IDs of VERIFY-stage tickets to compare
}
```

**Validation**:
1. All `ticketIds` must exist and belong to `projectId`
2. All tickets must be in `VERIFY` stage
3. All tickets must have a non-null `branch`
4. Array length: 2–5 items
5. No duplicate IDs

**Response** `201 Created`:

```typescript
{
  jobId: number;
  status: "PENDING";
  sourceTicketKey: string;  // first selected ticket used as source
  participantTicketKeys: string[];
}
```

**Side Effects**:
1. Creates a `Job` record with `command: "comment-verify"`, `status: "PENDING"`
2. Dispatches `ai-board-assist.yml` workflow via `dispatchAIBoardWorkflow()` with constructed compare command text

**Error Responses**:
- `400 Bad Request`: `{ error: "At least 2 tickets required" }` or `{ error: "Ticket {key} is not in VERIFY stage" }` or `{ error: "Ticket {key} has no branch" }`
- `401 Unauthorized`: `{ error: "Unauthorized" }`
- `404 Not Found`: `{ error: "Ticket not found: {id}" }`
- `500 Internal Server Error`: `{ error: "Internal server error" }`

---

### GET `/api/projects/:projectId/tickets/verify`

**Purpose**: List tickets currently in VERIFY stage for the comparison selection UI.

**Auth**: Session-based — `verifyProjectAccess(projectId)`

**Response** `200 OK`:

```typescript
{
  tickets: VerifyStageTicket[];
}
```

**`VerifyStageTicket` shape**:

```typescript
interface VerifyStageTicket {
  id: number;
  ticketKey: string;
  title: string;
  branch: string | null;
}
```

**Error Responses**:
- `400 Bad Request`: `{ error: "Invalid project ID" }`
- `401 Unauthorized`: `{ error: "Unauthorized" }`
- `500 Internal Server Error`: `{ error: "Internal server error" }`

---

## Hooks (Client-Side)

### `useProjectComparisons(projectId, limit, offset)`

```typescript
function useProjectComparisons(
  projectId: number,
  limit?: number,  // default 20
  enabled?: boolean
): UseQueryResult<{
  comparisons: ProjectComparisonSummary[];
  total: number;
  limit: number;
  offset: number;
}>
```

- **Query Key**: `['comparisons', 'project', projectId, limit, offset]`
- **Stale Time**: 30 seconds
- **Supports**: "Load More" by incrementing offset

### `useProjectComparisonDetail(projectId, comparisonId)`

```typescript
function useProjectComparisonDetail(
  projectId: number,
  comparisonId: number | null
): UseQueryResult<ComparisonDetail>
```

- **Query Key**: `['comparisons', 'project', projectId, 'detail', comparisonId]`
- **Stale Time**: 5 minutes
- **Enabled**: Only when `comparisonId !== null`

### `useVerifyStageTickets(projectId)`

```typescript
function useVerifyStageTickets(
  projectId: number,
  enabled?: boolean
): UseQueryResult<{ tickets: VerifyStageTicket[] }>
```

- **Query Key**: `['tickets', 'verify', projectId]`
- **Stale Time**: 30 seconds

### `useLaunchComparison(projectId)`

```typescript
function useLaunchComparison(
  projectId: number
): UseMutationResult<LaunchResponse, Error, { ticketIds: number[] }>
```

- **Invalidates**: `['comparisons', 'project', projectId]` on success
- **Optimistic**: Adds pending entry to comparison list
