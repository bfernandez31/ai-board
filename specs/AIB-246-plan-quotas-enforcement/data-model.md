# Data Model: Plan Quotas & Enforcement (AIB-246)

## Schema Changes

### Modified Interface: `PlanLimits`

**File**: `lib/billing/plans.ts`

```typescript
export interface PlanLimits {
  maxProjects: number | null;           // existing
  maxTicketsPerMonth: number | null;    // existing
  membersEnabled: boolean;              // existing
  maxMembersPerProject: number | null;  // NEW - max members per project (null = unlimited)
  advancedAnalytics: boolean;           // existing
}
```

### Updated Plan Configurations

| Field | FREE | PRO | TEAM |
|-------|------|-----|------|
| maxProjects | 1 | null | null |
| maxTicketsPerMonth | 5 | null | null |
| membersEnabled | false | false | true |
| maxMembersPerProject | 0 | 0 | 10 |
| advancedAnalytics | false | false | true |

### No Prisma Schema Changes Required

The existing `Subscription` model already stores `plan` (enum: FREE, PRO, TEAM). Plan limits are derived from the plan via `getPlanLimits()` — they are not stored in the database. The `maxMembersPerProject` field is added to the TypeScript configuration only.

---

## New API Response Types

### UsageData (for `/api/billing/usage`)

```typescript
interface UsageData {
  plan: 'FREE' | 'PRO' | 'TEAM';
  planName: string;
  projects: {
    current: number;
    max: number | null;  // null = unlimited
  };
  ticketsThisMonth: {
    current: number;
    max: number | null;  // null = unlimited
    resetDate: string;   // ISO date of next month 1st
  };
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  gracePeriodEndsAt: string | null;
}
```

---

## Entities (No New Database Tables)

This feature uses existing models only:

| Entity | Role in Feature | Already Exists |
|--------|----------------|----------------|
| Subscription | Determines user's plan tier | Yes |
| Project | Counted against maxProjects | Yes |
| Ticket | Counted against maxTicketsPerMonth (calendar month) | Yes |
| ProjectMember | Counted against maxMembersPerProject | Yes |
| User | Owner of subscription and projects | Yes |

---

## Counting Queries

### Project Count
```sql
SELECT COUNT(*) FROM "Project" WHERE "userId" = $1
```

### Monthly Ticket Count (calendar month, UTC)
```sql
SELECT COUNT(*) FROM "Ticket" t
JOIN "Project" p ON t."projectId" = p."id"
WHERE p."userId" = $1
AND t."createdAt" >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
```

### Per-Project Member Count
```sql
SELECT COUNT(*) FROM "ProjectMember" WHERE "projectId" = $1
```

---

## State Transitions

### Effective Plan Resolution (existing, unchanged)
```
Subscription.plan + Subscription.status + Subscription.gracePeriodEndsAt
  → getEffectivePlan()
    → if CANCELED → FREE
    → if PAST_DUE && gracePeriodEndsAt < now → FREE
    → else → plan as-is
```

### Downgrade Behavior (no new logic needed)
- Existing resources preserved (projects, tickets, members)
- New resource creation blocked when over limit
- `getEffectivePlan()` automatically downgrades on grace period expiry
