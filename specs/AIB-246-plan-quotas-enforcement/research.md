# Research: Plan Quotas & Enforcement (AIB-246)

## Research Summary

This feature is primarily a **UI-layer feature** with minor backend additions. The server-side quota enforcement for project creation, ticket creation, and member feature gating is already implemented (AIB-245). The remaining work focuses on: (1) adding usage visibility to the UI, (2) enforcing per-project member count limits, (3) gating advanced analytics, and (4) adding a usage stats API endpoint.

---

## Decision 1: Usage Data Fetching Strategy

**Decision**: Create a dedicated `/api/billing/usage` endpoint that returns current usage counts alongside plan limits, rather than computing usage client-side from multiple queries.

**Rationale**:
- Single API call provides all quota data (project count, monthly ticket count, member counts)
- Server-side counting is authoritative and avoids client/server disagreement
- Reuses existing `useSubscription()` polling pattern (15s interval)
- Keeps client components simple—they just render data, not compute it

**Alternatives Considered**:
1. **Client-side counting from existing data**: Would require projects list + ticket counts + member counts from separate queries. Fragile, could show stale or inconsistent data.
2. **Embed usage in subscription endpoint**: Would couple subscription data (rarely changes) with usage data (changes on every action). Different cache invalidation needs.
3. **Dedicated endpoint (chosen)**: Clean separation, single source of truth, easy to poll independently.

---

## Decision 2: Per-Project Member Count Limit

**Decision**: Add `maxMembersPerProject: number | null` to the `PlanLimits` interface and enforce it in the member addition API route.

**Rationale**:
- The spec requires Team plan to allow max 10 members per project (FR-005)
- Current implementation only gates `membersEnabled` (boolean), no count limit
- Adding a numeric limit follows the same pattern as `maxProjects` and `maxTicketsPerMonth`
- Set FREE/PRO to `0` (members not allowed), TEAM to `10`

**Alternatives Considered**:
1. **Keep boolean + hardcode 10**: Simpler but less configurable for future plan changes
2. **Add numeric field (chosen)**: Consistent with existing limit pattern, easy to adjust per plan

---

## Decision 3: Analytics Gating Implementation

**Decision**: Gate advanced analytics at the UI level using the existing `advancedAnalytics` boolean from `PlanLimits`. No new API endpoint needed—the analytics data endpoint returns the same data regardless; the UI controls visibility.

**Rationale**:
- The spec states "Basic analytics" = current dashboard, "Advanced analytics" = future Team-only features (not yet defined)
- Since advanced analytics features don't exist yet, the gate is a placeholder
- The `advancedAnalytics` flag already exists in `PlanLimits`
- Adding a UI gate now (with upgrade prompt) prepares for future advanced features

**Alternatives Considered**:
1. **Server-side API gating**: Overkill since advanced analytics endpoints don't exist yet
2. **UI-level gate with upgrade prompt (chosen)**: Minimal code, future-ready, matches spec scope

---

## Decision 4: Usage Indicator Placement

**Decision**: Show usage indicators in three locations: (1) projects list page header, (2) new ticket modal, (3) dashboard sidebar/header.

**Rationale**:
- Spec requires "inline on dashboard and within creation forms" (Auto-Resolved Decision 1)
- Projects list is the main dashboard view where users see their projects
- New ticket modal is the creation form where ticket limits matter
- Placing indicators at the point of action maximizes user awareness before hitting limits

**Alternatives Considered**:
1. **Dedicated usage page**: Spec explicitly rejected this (Auto-Resolved Decision 1)
2. **Inline only in creation forms**: Misses the dashboard requirement
3. **Both dashboard and forms (chosen)**: Matches spec requirements

---

## Decision 5: Upgrade Prompt Reuse

**Decision**: Reuse the existing `<UpgradePrompt>` component across all enforcement points, passing contextual `title` and `description` props.

**Rationale**:
- Component already exists at `components/billing/upgrade-prompt.tsx`
- Accepts `title` and `description` props for contextual messaging
- Links to `/settings/billing` for upgrade action
- Consistent styling with yellow warning theme

---

## Decision 6: Usage Counter API Design

**Decision**: The `/api/billing/usage` endpoint will return both current counts and limits in a single response, computing monthly ticket count using the same UTC calendar month logic already in the ticket creation API.

**Rationale**:
- Matches existing pattern in `app/api/projects/[projectId]/tickets/route.ts` (lines 125-144)
- UTC midnight on 1st of month is the reset boundary (consistent with spec FR-007)
- Returns `{ projects: { current, max }, ticketsThisMonth: { current, max }, plan }` shape
- Client components can compute remaining quotas from this data

---

## Dependency Analysis

| Dependency | Status | Notes |
|-----------|--------|-------|
| Stripe integration (AIB-245) | Complete | Subscription, plans, webhooks all implemented |
| `getUserSubscription()` | Complete | Handles grace period, effective plan computation |
| `PlanLimits` interface | Needs update | Add `maxMembersPerProject` field |
| `UpgradePrompt` component | Complete | Reusable, accepts title/description |
| `useSubscription` hook | Complete | 15s polling, returns plan + limits |
| Analytics dashboard | Complete | Recharts-based, TanStack Query polling |
| New ticket modal | Complete | Form with validation, handles PLAN_LIMIT errors |
