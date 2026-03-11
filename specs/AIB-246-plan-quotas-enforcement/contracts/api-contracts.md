# API Contracts: Plan Quotas & Enforcement (AIB-246)

## New Endpoint

### GET /api/billing/usage

Returns current resource usage counts and plan limits for the authenticated user.

**Auth**: Required (session or Bearer token)

**Request**: No body required.

**Response (200)**:
```json
{
  "plan": "FREE",
  "planName": "Free",
  "projects": {
    "current": 1,
    "max": 1
  },
  "ticketsThisMonth": {
    "current": 3,
    "max": 5,
    "resetDate": "2026-04-01T00:00:00.000Z"
  },
  "status": "active",
  "gracePeriodEndsAt": null
}
```

**Response for unlimited plan (200)**:
```json
{
  "plan": "PRO",
  "planName": "Pro",
  "projects": {
    "current": 4,
    "max": null
  },
  "ticketsThisMonth": {
    "current": 12,
    "max": null,
    "resetDate": "2026-04-01T00:00:00.000Z"
  },
  "status": "active",
  "gracePeriodEndsAt": null
}
```

**Response (401)**:
```json
{
  "error": "Unauthorized"
}
```

---

## Modified Endpoints

### POST /api/projects/[projectId]/members

**Change**: Add per-project member count enforcement after the existing `membersEnabled` gate.

**New 403 response** (member limit reached):
```json
{
  "error": "Member limit reached. Your Team plan allows 10 members per project.",
  "code": "PLAN_LIMIT"
}
```

**Enforcement logic** (pseudocode):
```
1. Existing: check membersEnabled → 403 if false
2. NEW: if maxMembersPerProject !== null:
   a. count members in this project
   b. if count >= maxMembersPerProject → 403 PLAN_LIMIT
3. Proceed with member addition
```

---

## Unchanged Endpoints (already enforced)

### POST /api/projects
- Already enforces `maxProjects` with Serializable transaction
- Returns 403 with `code: 'PLAN_LIMIT'` when limit reached

### POST /api/projects/[projectId]/tickets
- Already enforces `maxTicketsPerMonth` with calendar month counting (UTC)
- Returns 403 with `code: 'PLAN_LIMIT'` when limit reached

### GET /api/billing/subscription
- Already returns plan, status, limits, and grace period data
- No changes needed

### GET /api/billing/plans
- Already returns all plan configurations with limits
- No changes needed
