# Phase 0: Research & Decisions

**Feature**: Notification Click Navigation to Ticket Conversation Tab
**Date**: 2025-11-25

## Technical Decisions

### 1. Navigation Strategy: Same Window vs New Tab

**Decision**: Use same-window navigation for same-project notifications, new tab for cross-project

**Rationale**:
- **Same-project**: Preserves board state and reduces cognitive load. User is already in the correct project context.
- **Cross-project**: Opening in a new tab prevents losing work in the current project. Users often need to reference both projects simultaneously.
- **Browser behavior**: `router.push()` for same-project (Next.js client-side navigation), `window.open()` for cross-project

**Alternatives considered**:
- Always open in new tab: Would clutter browser tabs unnecessarily for same-project clicks
- Always open in same window: Would lose board context when navigating across projects
- Modal popup: Would be blocked by browser popup blockers and feels less integrated

**Implementation**:
- Compare `notification.projectId` with current route's `projectId`
- Use Next.js `useRouter().push()` for same-project
- Use `window.open()` with `target="_blank"` for cross-project

---

### 2. Tab Selection Mechanism: URL Hash vs State Prop

**Decision**: Use both URL hash parameter AND React state prop (`initialTab`)

**Rationale**:
- **URL hash approach**: Enables deep linking, shareable URLs, and browser back/forward navigation
- **State prop approach**: Provides immediate control over tab selection without URL manipulation
- **Hybrid approach**: Use URL hash as source of truth, parse it to determine `initialTab` prop for modal
- **Existing pattern**: Modal already uses `initialTab` prop (line 85-86 in ticket-detail-modal.tsx), so extending this is consistent

**Alternatives considered**:
- Only URL hash: Would require modal to parse hash on every render, more complex
- Only state prop: Would lose deep linking and shareable URL benefits
- Query parameter (`?tab=comments`): Hash is more appropriate for in-page navigation without server round-trip

**Implementation**:
- Notification URL format: `/projects/{projectId}/tickets/{ticketKey}?modal=open&tab=comments#comment-{commentId}`
- Board component reads `tab` query param and passes as `initialTab` to modal
- Modal's `useEffect` respects `initialTab` prop (already exists, line 198-206)
- Comment anchor scroll uses existing `#comment-{id}` pattern

---

### 3. Scroll Behavior: Auto-scroll Timing

**Decision**: Scroll after tab switch completes AND timeline renders (using `useEffect` with tab dependency)

**Rationale**:
- **Timing challenge**: Cannot scroll to comment if it hasn't rendered yet
- **Tab switch is async**: React state update + DOM update takes time
- **Timeline render**: ConversationTimeline component needs to fetch and render comments first
- **Existing anchor pattern**: Notification already includes `#comment-{id}` in URL (line 26 notification-dropdown.tsx)

**Alternatives considered**:
- Immediate scroll: Would fail because comment element doesn't exist yet
- Fixed delay (setTimeout): Brittle, breaks on slow networks or devices
- Manual scroll API: More complex, loses native browser anchor behavior
- IntersectionObserver: Over-engineered for this use case

**Implementation**:
- Let browser handle scroll via URL anchor (`#comment-{commentId}`)
- Add `useEffect` in ConversationTimeline to ensure scroll happens after render
- Fallback: If anchor scroll fails, use `scrollIntoView({ behavior: 'smooth', block: 'center' })`

---

### 4. Mark-as-Read Timing: Before vs After Navigation

**Decision**: Mark as read BEFORE navigation (optimistic update)

**Rationale**:
- **Immediate feedback**: User sees notification disappear from unread list instantly
- **Perceived performance**: No waiting for server response before navigation
- **Matches user intent**: Clicking notification implies "I've seen this"
- **Error handling**: If mark-as-read fails, doesn't block navigation (graceful degradation)
- **Existing pattern**: useMarkNotificationRead already uses optimistic updates (TanStack Query mutations)

**Alternatives considered**:
- Mark after navigation: Would delay visual feedback, feels laggy
- Mark after modal opens: Could fail if user closes modal quickly
- Mark after comment scrolls: Too delayed, violates user expectations

**Implementation**:
- Call `markAsRead.mutate(notification.id)` FIRST
- Then call navigation logic
- TanStack Query handles optimistic update and rollback on error
- No blocking await - fire and forget pattern

---

### 5. Race Condition Prevention: Rapid Clicks

**Decision**: Disable notification item during navigation (CSS pointer-events) + debounce

**Rationale**:
- **Problem**: User rapidly clicks multiple notifications
- **Risk**: Multiple navigations queued, browser state becomes unpredictable
- **Simple solution**: Disable click handlers immediately on first click
- **User feedback**: Visual indicator (cursor: not-allowed, opacity change)

**Alternatives considered**:
- Queue clicks: Over-engineered, users don't expect queued navigation
- Ignore subsequent clicks: Could feel unresponsive if first click is slow
- Modal lock: Would prevent all interactions, too aggressive

**Implementation**:
- Add `isPending` state from navigation mutation
- Apply `pointer-events: none` to notification items during navigation
- Show loading spinner or reduced opacity
- Re-enable after navigation completes (success or error)

---

### 6. URL Structure for Cross-Project Navigation

**Decision**: Construct full URL path with query params and hash

**Format**: `/projects/{projectId}/tickets/{ticketKey}?modal=open&tab=comments#comment-{commentId}`

**Rationale**:
- **Modal trigger**: `?modal=open` ensures ticket modal opens on page load
- **Tab selection**: `?tab=comments` specifies which tab to show
- **Scroll target**: `#comment-{commentId}` provides anchor for scroll
- **Consistency**: Matches existing URL patterns in the app
- **Shareable**: Users can copy/paste URL to share exact comment location

**Alternatives considered**:
- Minimal URL (`/tickets/{ticketKey}`): Would require complex state initialization
- Only hash anchor: Wouldn't convey tab selection intent
- Custom URL scheme: Would break Next.js conventions

**Implementation**:
- Build URL in utility function: `buildNotificationUrl(notification)`
- Use Next.js route patterns for proper URL construction
- Encode ticket key properly for URL safety

---

## Best Practices Applied

### Next.js App Router Navigation
- **Client-side routing**: Use `useRouter()` from `next/navigation`
- **Prefetching**: Next.js automatically prefetches on hover (no action needed)
- **Shallow routing**: Use `router.push()` with shallow option to preserve client state

### React State Management
- **TanStack Query**: Already used for notification fetching, extend for mutations
- **Optimistic updates**: Consistent with existing patterns (ticket updates, comment creation)
- **Cache invalidation**: Invalidate notification cache after mark-as-read

### TypeScript Patterns
- **Type guards**: Validate notification shape before navigation
- **Strict null checks**: Handle missing projectId, ticketKey gracefully
- **Interface contracts**: Define NavigationContext, NotificationData interfaces

### Error Handling
- **Graceful degradation**: If mark-as-read fails, still navigate
- **User feedback**: Toast notifications for errors
- **Logging**: Console errors for debugging (dev only)

### Accessibility
- **Keyboard navigation**: Enter/Space on notification items (already exists)
- **Screen readers**: Announce navigation events via `aria-live` regions
- **Focus management**: Return focus to modal after navigation

---

## Integration Points

### Existing Code to Modify
1. **notification-dropdown.tsx**: Add navigation logic to `handleNotificationClick`
2. **ticket-detail-modal.tsx**: Already accepts `initialTab` prop (no changes needed to interface)
3. **board.tsx**: Read `tab` query param from URL and pass to modal
4. **use-notifications.ts**: Ensure mark-as-read mutation exists (already implemented)

### New Code to Create
1. **lib/utils/navigation-utils.ts**: Navigation helper functions
2. **app/api/notifications/[id]/read/route.ts**: Mark-as-read API endpoint (if not exists)
3. **lib/validations/notification.ts**: Zod schemas for validation
4. **tests/unit/navigation-utils.test.ts**: Vitest unit tests
5. **tests/e2e/notification-navigation.spec.ts**: Playwright E2E tests

---

## Research Summary

All technical unknowns from Technical Context have been resolved:
- ✅ Navigation strategy (same window vs new tab): Hybrid approach based on project context
- ✅ Tab selection mechanism: URL hash + state prop hybrid
- ✅ Scroll timing: Browser anchor + useEffect fallback
- ✅ Mark-as-read timing: Before navigation (optimistic)
- ✅ Race condition prevention: Disable during navigation
- ✅ URL structure: Query params + hash for full context

No blocking issues identified. Ready to proceed to Phase 1 (Design & Contracts).
