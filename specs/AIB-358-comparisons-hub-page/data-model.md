# Data Model: Comparisons Hub Page

**Date**: 2026-03-27 | **Branch**: `AIB-358-comparisons-hub-page`

## Schema Changes

**No schema changes required.** This feature reads from existing models only.

## Existing Entities Used

### ComparisonRecord (read-only)

The hub page queries `ComparisonRecord` at the project level. Key fields used:

| Field | Type | Usage in Hub |
|-------|------|--------------|
| `id` | Int (PK) | List item identifier, detail fetch key |
| `projectId` | Int (FK → Project) | Filter comparisons by project |
| `sourceTicketId` | Int (FK → Ticket) | Display source ticket context |
| `winnerTicketId` | Int (FK → Ticket) | Display winner in list card |
| `summary` | String(2000) | List card summary text |
| `overallRecommendation` | String(10000) | Detail view recommendation |
| `keyDifferentiators` | Json | Detail view differentiator badges |
| `generatedAt` | DateTime | List sort order + display date |

**Index used**: `(projectId, generatedAt DESC)` — optimal for project-level listing.

### ComparisonParticipant (read-only, via relation)

| Field | Type | Usage in Hub |
|-------|------|--------------|
| `rank` | Int | List card: show winner rank, participant count |
| `score` | Float | List card: winner score display |
| `ticketId` | Int (FK → Ticket) | Resolve ticket key/title |
| `rankRationale` | String(4000) | Detail view participant info |

### Ticket (read-only, for New Comparison launcher)

| Field | Type | Usage in Hub |
|-------|------|--------------|
| `id` | Int (PK) | Checkbox selection value |
| `ticketKey` | String | Display in selection UI |
| `title` | String | Display in selection UI |
| `stage` | Enum(Stage) | Filter: `stage = 'VERIFY'` |
| `branch` | String? | Required for workflow dispatch |

### Job (write: one record per comparison launch)

| Field | Type | Usage in Hub |
|-------|------|--------------|
| `id` | Int (PK) | Track pending comparison state |
| `ticketId` | Int (FK → Ticket) | Source ticket for comparison |
| `projectId` | Int (FK → Project) | Project context |
| `command` | String | Set to `"comment-verify"` |
| `status` | Enum(JobStatus) | PENDING → RUNNING → COMPLETED/FAILED |
| `branch` | String | Source ticket branch |

## Query Patterns

### List Project Comparisons (paginated)

```sql
-- Prisma equivalent
SELECT cr.*,
       st.ticketKey AS sourceTicketKey,
       wt.ticketKey AS winnerTicketKey,
       cp.rank, cp.score, cp.ticket.ticketKey
FROM ComparisonRecord cr
JOIN Ticket st ON cr.sourceTicketId = st.id
JOIN Ticket wt ON cr.winnerTicketId = wt.id
JOIN ComparisonParticipant cp ON cp.comparisonRecordId = cr.id
WHERE cr.projectId = :projectId
ORDER BY cr.generatedAt DESC
LIMIT :limit OFFSET :offset
```

### Fetch VERIFY-Stage Tickets

```sql
SELECT id, ticketKey, title, branch
FROM Ticket
WHERE projectId = :projectId
  AND stage = 'VERIFY'
ORDER BY ticketKey ASC
```

### Comparison Detail (reuses existing pattern)

Existing `getComparisonDetailForTicket` enrichment pattern applies — fetches ComparisonRecord with all relations (participants, decisionPoints, complianceAssessments, metricSnapshots) and enriches with job telemetry and quality scores.

## State Transitions

### Comparison Launch Flow

```
User clicks "New Comparison" → selects tickets → clicks "Compare"
  ↓
API creates Job (status: PENDING)
  ↓
API dispatches ai-board-assist.yml workflow
  ↓
UI shows pending card in comparison list
  ↓
Workflow completes → POST /api/.../comparisons persists ComparisonRecord
  ↓
UI polling detects new ComparisonRecord → replaces pending with real entry
```

## Validation Rules

| Rule | Source | Enforcement |
|------|--------|-------------|
| Min 2 tickets selected | FR-009 | Frontend: disable button; Backend: Zod `min(2)` |
| Max 5 tickets selected | Existing constraint | Backend: Zod `max(5)` from `reportMetadataSchema` |
| All tickets in VERIFY stage | FR-007 | Backend: verify `stage = 'VERIFY'` for all selected tickets |
| All tickets in same project | Implicit | Backend: verify `projectId` matches for all tickets |
| Tickets have branches | Workflow requirement | Backend: verify `branch IS NOT NULL` |
| Limit 1-100, offset >= 0 | Existing pattern | Zod schema (already defined) |
