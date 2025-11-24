# Mention Notifications Research & Implementation Index

**Feature**: AIB-77 - Mention Notifications
**Created**: 2025-11-24
**Status**: Research Complete - Ready for Implementation

---

## Document Overview

This index organizes research materials for implementing mention notifications in the AI-Board Next.js application. All research is based on:

- **Specification**: `/specs/AIB-77-mention-notifications/spec.md`
- **Tech Stack**: TypeScript 5.6, Next.js 15 (App Router), TanStack Query v5.90.5, shadcn/ui, date-fns 4.1.0
- **Existing Patterns**: Leverages proven patterns from comment system, job polling, and optimistic updates

---

## Documents

### 1. MENTION_NOTIFICATIONS_RESEARCH.md (53 KB)
**Comprehensive research document with detailed rationale for each decision.**

**Contents**:
- Section 1: @Mention Parsing (regex patterns, type safety, implementation)
- Section 2: TanStack Query Polling (15-second intervals, dynamic configuration, background polling)
- Section 3: Optimistic Updates (onMutate pattern, rollback strategy, error handling)
- Section 4: Notification UI (Popover, Badge, ScrollArea, component hierarchy)
- Section 5: Relative Timestamps (date-fns formatDistanceToNow, hybrid approach)
- Implementation Checklist (6 phases)
- Summary Table (quick reference)
- References (15+ sources)

**Best For**: Understanding the "why" behind each decision, evaluating alternatives, design review.

**Read Time**: 30-40 minutes

---

### 2. MENTION_NOTIFICATIONS_QUICK_REFERENCE.md (8 KB)
**One-page summary with decision table, code templates, and quick lookups.**

**Contents**:
- Quick Decision Summary Table
- Implementation Priority (MVP vs Phase 2)
- Code Templates (4 essential patterns)
- Database Schema (Prisma model)
- API Endpoints (3 endpoints with request/response)
- Component Tree (hierarchy diagram)
- Hooks & Mutations (list of required hooks)
- Testing Checklist
- Edge Cases
- Known Gotchas

**Best For**: Getting started quickly, implementation kickoff, team onboarding.

**Read Time**: 5-10 minutes

---

### 3. MENTION_NOTIFICATIONS_CODE_SNIPPETS.md (27 KB)
**Copy-paste ready code examples organized by section.**

**Contents**:
- Section 1: Prisma Schema (database model)
- Section 2: Comment Creation Handler (notification extraction & creation)
- Section 3: Notification List Endpoint (GET /api/notifications)
- Section 4: Mark as Read Endpoint (PATCH /api/notifications/:id/read)
- Section 5: Mark All as Read Endpoint (PATCH /api/notifications/mark-all-read)
- Section 6: Query Keys Factory (TanStack Query setup)
- Section 7: useNotifications Hook (polling with 15s interval)
- Section 8: useMarkNotificationRead Hook (optimistic mutation)
- Section 9: useMarkAllNotificationsRead Hook (batch mutation)
- Section 10: Time Formatting Utility (date-fns integration)
- Section 11: TypeScript Types (Notification interface)
- Section 12: NotificationBell Component (with badge)
- Section 13: NotificationDropdown Component (container)
- Section 14: NotificationItem Component (individual notification)
- Section 15: NotificationHeader Component (title + actions)
- Bonus: Unit Test Example (vitest)
- Bonus: Integration Test Example (Playwright)

**Best For**: Implementation, copy-paste during coding, reference during testing.

**Read Time**: Use as reference as needed

---

## Key Research Findings

### Decision 1: @Mention Parsing
- **Decision**: Regex-based parsing on pre-formatted `@[userId:displayName]` markup
- **Pattern**: `/@\[([^:]+):([^\]]+)\]/g`
- **Why**: Leverages existing mention system, type-safe, prevents invalid mentions
- **Implementation**: Use existing `extractMentionUserIds()` utility

### Decision 2: Notification Polling
- **Decision**: TanStack Query with 15-second `refetchInterval`
- **Configuration**: Dynamic intervals, background polling enabled, auto-retry
- **Why**: Matches spec requirement, consistent with comment polling pattern
- **Performance**: 4 requests/min per user is acceptable

### Decision 3: Optimistic Updates
- **Decision**: `useMutation` with `onMutate` callback for cache manipulation
- **Pattern**: Snapshot → optimistic update → rollback on error → refetch on settle
- **Why**: Instant visual feedback, safe error handling, propagates updates to all UI locations
- **Alternatives Rejected**: Simple variables approach (only single location), manual polling (no rollback)

### Decision 4: Notification UI
- **Decision**: shadcn/ui Popover + ScrollArea + Badge
- **Components**: Bell icon, badge count (1-9, "9+" for 10+), scrollable list (5 items)
- **Why**: Accessible (Radix UI), consistent with app design, built-in focus management
- **Gotcha**: ScrollArea in Popover may need explicit height wrapper

### Decision 5: Relative Timestamps
- **Decision**: Hybrid approach using `formatDistanceToNow` < 3 days, absolute dates >= 3 days
- **Why**: Scans better for recent notifications, precise dates for older ones
- **Library**: date-fns (already in package.json)
- **Examples**: "just now", "2 hours ago", "Nov 20, 2025"

---

## Implementation Phases

### Phase 1: Backend (Database & APIs)
- Add Notification model to Prisma schema
- Create comment API handler to extract mentions and create notifications
- Implement `/api/notifications` GET, PATCH endpoints
- Add 30-day retention cleanup job

### Phase 2: Query Hooks & Types
- Implement `useNotifications()` hook with 15s polling
- Create mutation hooks for mark read operations
- Add TypeScript types and query key factory

### Phase 3: UI Components (Notification Bell + Dropdown)
- NotificationBell (bell icon + badge)
- NotificationDropdown (container)
- NotificationItem (individual notification)
- NotificationHeader (title + mark all as read)
- NotificationFooter (view all link)
- NotificationList (ScrollArea wrapper)

### Phase 4: Utilities & Integration
- Time formatting utility (format-notification-time.ts)
- Integration with mention parser
- Add to application header/nav

### Phase 5: Testing
- Unit tests (parsing, formatting, hooks)
- Integration tests (notification creation, read status)
- E2E tests (full user flow with Playwright)

### Phase 6: Enhancement (Optional)
- Full `/notifications` page with pagination
- Notification filters and preferences
- Batch cleanup improvements

---

## File Locations

### Database & API Routes
```
/app/api/notifications/
  ├── route.ts                    # GET list
  ├── mark-all-read/route.ts      # PATCH mark all
  └── [id]/read/route.ts          # PATCH mark single
```

### Hooks
```
/app/lib/hooks/
  ├── queries/
  │   └── use-notifications.ts    # Polling hook
  └── mutations/
      ├── use-mark-notification-read.ts          # Single read
      └── use-mark-all-notifications-read.ts     # Batch read
```

### Components
```
/components/notifications/
  ├── notification-bell.tsx       # Bell icon + badge
  ├── notification-dropdown.tsx   # Container
  ├── notification-item.tsx       # Individual card
  ├── notification-header.tsx     # Title + actions
  ├── notification-footer.tsx     # View all link
  └── notification-list.tsx       # ScrollArea wrapper
```

### Utilities
```
/app/lib/utils/
  └── format-notification-time.ts # date-fns integration

/app/lib/types/
  └── notification.ts              # TypeScript types

/app/lib/
  └── query-keys.ts              # Query key factory
```

### Prisma
```
/prisma/
  └── schema.prisma              # Notification model
```

---

## Technology Summary

| Technology | Version | Purpose |
|-----------|---------|---------|
| **TypeScript** | 5.6 | Type safety throughout |
| **Next.js** | 15 | App Router, API routes |
| **TanStack Query** | v5.90.5 | Polling, caching, mutations |
| **shadcn/ui** | Latest | UI components (Popover, Badge, ScrollArea) |
| **Radix UI** | Via shadcn/ui | Accessible component primitives |
| **date-fns** | 4.1.0 | Relative timestamp formatting |
| **Lucide React** | Latest | Bell icon |
| **Tailwind CSS** | 3.4 | Styling |
| **Prisma** | 6.x | Database ORM |
| **PostgreSQL** | 14+ | Database |

---

## Key Patterns from Existing Code

### Mention Parsing (Already Implemented)
- Location: `/app/lib/utils/mention-parser.ts`
- Provides: `parseMentions()`, `extractMentionUserIds()`, `formatMention()`, `validateMentionFormat()`
- Format: `@[userId:displayName]`

### Comment Polling (Reference Pattern)
- Location: `/app/lib/hooks/queries/use-comments.ts`
- Uses: TanStack Query with configurable `refetchInterval`
- Benefit: Can adapt same pattern for notifications

### Job Polling (Reference Pattern)
- Location: `/app/lib/hooks/useJobPolling.ts`
- Features: Dynamic intervals, background polling, terminal state detection
- Benefit: Demonstrates sophisticated polling patterns in codebase

### Optimistic Updates (Reference Pattern)
- Location: `/lib/optimistic-updates.ts`
- Functions: `updateTicketStageOptimistically()`, `revertTicketStage()`, `confirmTicketUpdate()`
- Benefit: Shows established optimistic update pattern

### Time Formatting (Reference Pattern)
- Location: `/lib/utils/format-timestamp.ts`
- Uses: `Intl.RelativeTimeFormat` + `Intl.DateTimeFormat`
- Enhancement: Our implementation uses date-fns (more concise)

---

## Success Criteria

From `/specs/AIB-77-mention-notifications/spec.md`:

✅ **SC-001**: Users discover mentions within 30 seconds (15s polling + interaction)
✅ **SC-002**: 95% of notification clicks navigate to correct comment
✅ **SC-003**: Unread count accurate within 15 seconds
✅ **SC-004**: Mark 10+ notifications read in < 2 seconds
✅ **SC-005**: Dropdown loads within 500ms
✅ **SC-006**: Zero invalid mention notifications
✅ **SC-007**: Handle 50 concurrent mentions without loss

---

## Testing Strategy

### Unit Tests (Vitest)
- Mention parsing and extraction
- Time formatting (all ranges)
- Hook behavior with mock data

### Integration Tests
- Notification creation (with comment)
- Mutation optimistic updates
- Query invalidation behavior

### E2E Tests (Playwright)
- Full user flow: mention → notification → click → navigate
- Polling updates (15-second intervals)
- Mark as read (single and batch)
- Badge count accuracy
- Dropdown interaction (open/close, scroll)

---

## References & Sources

**TypeScript & Regex**:
- [Mastering TypeScript Regex Matching](https://www.webdevtutor.net/blog/typescript-regex-matching)
- [mentions-regex - npm](https://www.npmjs.com/package/mentions-regex)
- [GitHub mentions-regex](https://github.com/regexhq/mentions-regex)

**TanStack Query Polling**:
- [TanStack Query v5 Important Defaults](https://tanstack.com/query/v5/docs/react/guides/important-defaults)
- [Auto Refetching Example](https://tanstack.com/query/v5/docs/framework/react/examples/auto-refetching)
- [useQuery Reference](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery)
- [TanStack Query: Mastering Polling](https://medium.com/@soodakriti45/tanstack-query-mastering-polling-ee11dc3625cb)

**Optimistic Updates**:
- [TanStack Query Optimistic Updates Guide](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [TypeScript Examples](https://tanstack.com/query/v5/docs/framework/react/examples/optimistic-updates-typescript)

**shadcn/ui**:
- [Popover Documentation](https://ui.shadcn.com/docs/components/popover)
- [Badge Documentation](https://ui.shadcn.com/docs/components/badge)
- [ScrollArea Issue #542](https://github.com/shadcn-ui/ui/issues/542)

**date-fns**:
- [formatDistanceToNow Documentation](https://date-fns.org/docs/formatDistanceToNow)
- [Relative Timestamps in Astro JS](https://www.ansonlichtfuss.com/blog/relative-timestamps-in-astro-js-date-fns-typescript)

---

## Quick Links

- **Feature Spec**: `/specs/AIB-77-mention-notifications/spec.md`
- **Existing Mention Parser**: `/app/lib/utils/mention-parser.ts`
- **Existing Comment Polling**: `/app/lib/hooks/queries/use-comments.ts`
- **This Research Suite**:
  - Full research: `MENTION_NOTIFICATIONS_RESEARCH.md`
  - Quick ref: `MENTION_NOTIFICATIONS_QUICK_REFERENCE.md`
  - Code snippets: `MENTION_NOTIFICATIONS_CODE_SNIPPETS.md`

---

## Getting Started

1. **Read Quick Reference** (5 min): `MENTION_NOTIFICATIONS_QUICK_REFERENCE.md`
2. **Review Decisions** (15 min): First section of each topic in `MENTION_NOTIFICATIONS_RESEARCH.md`
3. **Start Coding** (ongoing): Use `MENTION_NOTIFICATIONS_CODE_SNIPPETS.md` as reference
4. **Deep Dive** (as needed): Full details in `MENTION_NOTIFICATIONS_RESEARCH.md`

---

**Document Version**: 1.0
**Last Updated**: 2025-11-24
**Ready for Implementation**: ✅ Yes
**Questions?**: Refer to appropriate section in research documents
