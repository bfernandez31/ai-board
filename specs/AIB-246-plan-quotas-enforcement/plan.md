# Implementation Plan: Plan Quotas & Enforcement (AIB-246)

**Branch**: `AIB-246-plan-quotas-enforcement`
**Spec**: `specs/AIB-246-plan-quotas-enforcement/spec.md`
**Created**: 2026-03-10

---

## Technical Context

### Current State
The Stripe integration (AIB-245) is fully implemented. Server-side quota enforcement already exists for:
- **Project creation**: Atomic Serializable transaction checks `maxProjects` (FR-001, FR-003)
- **Ticket creation**: Calendar month counting checks `maxTicketsPerMonth` (FR-002, FR-004, FR-007)
- **Member feature gate**: Boolean `membersEnabled` check blocks Free/Pro users (FR-005 partial)
- **Grace period**: `getEffectivePlan()` correctly downgrades to FREE after 7-day grace (FR-010, FR-011)
- **Downgrade preservation**: Existing resources are preserved; only new creation is blocked (FR-012)

### Gaps to Fill
1. **Per-project member count limit** (max 10 for Team) — not enforced (FR-005 incomplete)
2. **Usage visibility API** — no endpoint returns current usage counts
3. **Dashboard usage indicators** — no UI shows project/ticket consumption (FR-008, FR-013)
4. **Ticket creation form usage** — no quota display in new ticket modal (FR-008)
5. **Analytics gating UI** — `advancedAnalytics` flag exists but no UI gate (FR-009)
6. **Upgrade prompts at enforcement points** — `UpgradePrompt` component exists but not integrated into creation flows (FR-006)

### Dependencies
| Dependency | Status |
|-----------|--------|
| Stripe integration (AIB-245) | Complete |
| `getUserSubscription()` with grace period | Complete |
| `PlanLimits` interface | Needs `maxMembersPerProject` field |
| `UpgradePrompt` component | Complete, reusable |
| `useSubscription` hook | Complete, 15s polling |
| Analytics dashboard | Complete |
| New ticket modal | Complete, handles PLAN_LIMIT errors |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code uses strict TypeScript; `PlanLimits` interface updated with explicit types |
| II. Component-Driven | PASS | Reuses `UpgradePrompt`, shadcn/ui components; feature components in `/components/billing/` |
| III. Test-Driven | PASS | Integration tests for usage API; component tests for usage indicators |
| IV. Security-First | PASS | Server-side enforcement is authoritative; UI is informational only |
| V. Database Integrity | PASS | No schema changes; counting queries use Prisma |
| VI. AI-First Development | PASS | No documentation files; plan artifacts in `specs/` |
| Forbidden Dependencies | PASS | No new dependencies added |

---

## Implementation Phases

### Phase 1: Backend — Plan Limits & Usage API

**Goal**: Add `maxMembersPerProject` to plan config, enforce it server-side, and create the usage endpoint.

#### Task 1.1: Update PlanLimits Interface
- **File**: `lib/billing/plans.ts`
- **Change**: Add `maxMembersPerProject: number | null` to `PlanLimits`
- **Values**: FREE=0, PRO=0, TEAM=10
- **Impact**: TypeScript compilation will flag all consumers needing updates

#### Task 1.2: Enforce Per-Project Member Count
- **File**: `app/api/projects/[projectId]/members/route.ts`
- **Change**: After the existing `membersEnabled` check, add member count check
- **Logic**: Count `ProjectMember` records for the project; compare against `maxMembersPerProject`
- **Error**: 403 with `code: 'PLAN_LIMIT'`, message includes limit number

#### Task 1.3: Create Usage API Endpoint
- **File**: `app/api/billing/usage/route.ts` (new)
- **Method**: GET, requires auth
- **Returns**: `{ plan, planName, projects: { current, max }, ticketsThisMonth: { current, max, resetDate }, status, gracePeriodEndsAt }`
- **Queries**: Count user's projects; count tickets created since 1st of current month (UTC)

#### Task 1.4: Update Subscription API Response
- **File**: `app/api/billing/subscription/route.ts`
- **Change**: Ensure `maxMembersPerProject` is included in the limits response (may already work if serialized from `PlanLimits`)

### Phase 2: Frontend — Usage Hook & Indicators

**Goal**: Create a `useUsage` hook and add usage indicators to the dashboard and creation forms.

#### Task 2.1: Create useUsage Hook
- **File**: `hooks/use-usage.ts` (new)
- **Pattern**: TanStack Query, polls `/api/billing/usage` every 15s (matches `useSubscription`)
- **Returns**: `UsageData` with current counts and limits
- **Invalidation**: Invalidate on project/ticket creation mutations

#### Task 2.2: Add Usage Banner to Projects List
- **File**: `app/projects/page.tsx` + new component `components/billing/usage-banner.tsx`
- **Display**: For Free users: "1/1 projects | 3/5 tickets this month | Free Plan"
- **Display**: For paid users: "Pro Plan" or "Team Plan" (no numeric quotas)
- **Condition**: Only show quota numbers when limits are not null

#### Task 2.3: Add Usage Indicator to New Ticket Modal
- **File**: `components/board/new-ticket-modal.tsx`
- **Display**: Below form title, show "X/Y tickets used this month" for Free users
- **Behavior**: When limit reached, disable submit button and show `UpgradePrompt` instead of form
- **Hook**: Use `useUsage()` to get current ticket count

#### Task 2.4: Add Usage Indicator to Project Creation
- **File**: Component that handles project creation (projects page header area)
- **Display**: When Free user at project limit, disable "New Project" button and show tooltip/upgrade prompt
- **Hook**: Use `useUsage()` to check `projects.current >= projects.max`

### Phase 3: Frontend — Analytics Gating & Upgrade Prompts

**Goal**: Gate advanced analytics and ensure upgrade prompts appear at all enforcement points.

#### Task 3.1: Gate Advanced Analytics Section
- **File**: `components/analytics/analytics-dashboard.tsx`
- **Change**: Add a section/tab for "Advanced Analytics" that shows `UpgradePrompt` for non-Team users
- **Logic**: Check `subscription.limits.advancedAnalytics` via `useSubscription()`
- **Note**: Since advanced features don't exist yet, this is a placeholder gate with upgrade CTA

#### Task 3.2: Handle PLAN_LIMIT Errors in Creation Flows
- **File**: `components/board/new-ticket-modal.tsx`
- **Change**: The modal already handles 403 errors; ensure the error message from the API is displayed prominently with upgrade link
- **Verify**: Project creation flow also handles PLAN_LIMIT errors gracefully

#### Task 3.3: Grace Period Banner
- **File**: `components/billing/usage-banner.tsx`
- **Change**: When `status === 'past_due'` and `gracePeriodEndsAt` is set, show warning banner: "Payment failed. Your plan limits will be reduced to Free on [date]. Update payment method."
- **Link**: Points to `/settings/billing` (Stripe customer portal)

### Phase 4: Testing

**Goal**: Verify all quota enforcement and UI indicators work correctly.

#### Task 4.1: Integration Tests — Usage API
- **File**: `tests/integration/billing/usage.test.ts` (new or extend existing)
- **Tests**: GET /api/billing/usage returns correct counts for Free/Pro/Team users
- **Tests**: Monthly ticket count resets on calendar month boundary

#### Task 4.2: Integration Tests — Member Count Limit
- **File**: `tests/integration/members/` (extend existing)
- **Tests**: Team user can add up to 10 members; 11th returns 403 PLAN_LIMIT
- **Tests**: Free/Pro user blocked entirely (existing test, verify still passes)

#### Task 4.3: Component Tests — Usage Indicators
- **File**: `tests/unit/components/usage-banner.test.tsx` (new)
- **Tests**: Free user sees quota numbers; Pro/Team user sees plan name only
- **Tests**: Grace period warning appears when status is past_due

#### Task 4.4: Component Tests — Ticket Modal Quota
- **File**: `tests/unit/components/new-ticket-modal.test.tsx` (extend existing if present)
- **Tests**: Free user sees ticket count; limit reached shows upgrade prompt

---

## File Change Summary

### New Files
| File | Purpose |
|------|---------|
| `app/api/billing/usage/route.ts` | Usage counts API endpoint |
| `hooks/use-usage.ts` | TanStack Query hook for usage data |
| `components/billing/usage-banner.tsx` | Dashboard usage indicator component |

### Modified Files
| File | Change |
|------|--------|
| `lib/billing/plans.ts` | Add `maxMembersPerProject` to PlanLimits and plan configs |
| `app/api/projects/[projectId]/members/route.ts` | Add per-project member count enforcement |
| `app/projects/page.tsx` | Add UsageBanner component |
| `components/board/new-ticket-modal.tsx` | Add ticket usage indicator and upgrade gate |
| `components/analytics/analytics-dashboard.tsx` | Add advanced analytics gate with upgrade prompt |

### Test Files
| File | Type |
|------|------|
| `tests/integration/billing/usage.test.ts` | Integration — usage API |
| `tests/integration/members/` (extend) | Integration — member count limit |
| `tests/unit/components/usage-banner.test.tsx` | Component — usage indicators |
| `tests/unit/components/new-ticket-modal.test.tsx` (extend) | Component — ticket quota display |

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Race condition on member count | Use Prisma transaction (same pattern as project creation) |
| Stale usage data in UI | 15s polling + invalidation on mutations |
| Grace period timezone edge cases | All dates stored and computed in UTC (existing pattern) |
| Breaking existing PLAN_LIMIT handling | New `maxMembersPerProject` field defaults correctly; existing boolean gate unchanged |
| Advanced analytics scope creep | Only add gate/placeholder; actual features deferred per spec |
