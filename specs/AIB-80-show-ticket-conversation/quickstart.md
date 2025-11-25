# Quickstart Guide: Notification Click Navigation

**Feature**: Click notification → Navigate to ticket's conversation tab with comment scrolled into view

**Prerequisites**:
- TypeScript 5.6+, Node.js 22.20+
- Next.js 15 (App Router)
- TanStack Query v5.90.5
- Prisma 6.x with PostgreSQL

---

## Implementation Checklist

### Phase 1: Utility Functions (30 mins)

**File**: `lib/utils/navigation-utils.ts` (NEW)

```typescript
// TODO: Implement these functions
export function buildNotificationUrl(params: NotificationUrlParams): string;
export function isSameProject(currentProjectId: number, targetProjectId: number): boolean;
export function createNavigationContext(notification: NotificationWithNavData, currentProjectId: number): NavigationContext;
```

**Tests**: `tests/unit/navigation-utils.test.ts` (NEW)
- ✅ Write Vitest tests FIRST (TDD)
- Test URL construction with various inputs
- Test project comparison logic
- Test edge cases (null values, invalid IDs)

**Commands**:
```bash
bun run test:unit tests/unit/navigation-utils.test.ts
```

---

### Phase 2: API Endpoint (20 mins)

**File**: `app/api/notifications/[id]/read/route.ts` (NEW)

```typescript
// PATCH /api/notifications/:id/read
// TODO: Implement mark-as-read endpoint
// - Validate user owns notification
// - Update read=true, readAt=now()
// - Return success response
```

**Security checks**:
- ✅ Verify `recipientId === currentUser.id`
- ✅ Check notification exists and not soft-deleted
- ✅ Use Prisma parameterized queries

**Testing**:
- Add E2E test in `tests/e2e/notification-navigation.spec.ts`

---

### Phase 3: Notification Component (45 mins)

**File**: `app/components/notifications/notification-dropdown.tsx` (MODIFY)

**Current code** (line 21-27):
```typescript
const handleNotificationClick = (notification: typeof notifications[number]) => {
  markAsRead.mutate(notification.id);
  router.push(`/projects/${notification.projectId}/tickets/${notification.ticketKey}#comment-${notification.commentId}`);
};
```

**Required changes**:
1. Extract current project ID from route (useParams)
2. Determine if same-project vs cross-project
3. Build proper URL with tab parameter
4. Use window.open() for cross-project, router.push() for same-project

**New implementation**:
```typescript
const handleNotificationClick = (notification: typeof notifications[number]) => {
  // Mark as read (optimistic update)
  markAsRead.mutate(notification.id);

  // Build navigation context
  const context = createNavigationContext(notification, currentProjectId);

  // Navigate based on context
  if (context.shouldOpenNewTab) {
    window.open(context.targetUrl, '_blank', 'noopener,noreferrer');
  } else {
    router.push(context.targetUrl);
  }
};
```

**Import additions**:
```typescript
import { useParams } from 'next/navigation';
import { createNavigationContext } from '@/lib/utils/navigation-utils';
```

---

### Phase 4: Board URL Parsing (30 mins)

**File**: `components/board/board.tsx` (MODIFY)

**Current modal opening** (approximate line 100-120):
```typescript
const [selectedTicket, setSelectedTicket] = useState<TicketWithVersion | null>(null);
const [detailModalOpen, setDetailModalOpen] = useState(false);
```

**Required changes**:
1. Read URL search params on mount
2. Parse `?modal=open&tab=comments` parameters
3. Pass `initialTab` to TicketDetailModal
4. Handle `#comment-{id}` hash for scroll

**New implementation**:
```typescript
const searchParams = useSearchParams();
const [initialTab, setInitialTab] = useState<'details' | 'comments' | 'files'>('details');

useEffect(() => {
  // Parse tab from URL
  const tabParam = searchParams.get('tab');
  if (tabParam === 'comments' || tabParam === 'files') {
    setInitialTab(tabParam);
  }

  // Check if modal should auto-open
  const modalParam = searchParams.get('modal');
  if (modalParam === 'open') {
    // Find ticket from URL and open modal
    const ticketKey = /* extract from path */;
    const ticket = /* find in ticketsByStage */;
    if (ticket) {
      setSelectedTicket(ticket);
      setDetailModalOpen(true);
    }
  }
}, [searchParams]);

// Pass initialTab to modal
<TicketDetailModal
  ticket={selectedTicket}
  open={detailModalOpen}
  onOpenChange={setDetailModalOpen}
  onUpdate={handleTicketUpdate}
  projectId={projectId}
  initialTab={initialTab}  // <-- Add this prop
/>
```

**Import additions**:
```typescript
import { useSearchParams } from 'next/navigation';
```

---

### Phase 5: Comment Scroll (20 mins)

**File**: `components/ticket/conversation-timeline.tsx` (MODIFY)

**Required changes**:
1. Add useEffect to scroll to comment anchor after render
2. Use `scrollIntoView()` if browser anchor fails

**New code**:
```typescript
useEffect(() => {
  // Check if URL has comment anchor
  const hash = window.location.hash;
  if (hash.startsWith('#comment-')) {
    // Wait for timeline to render
    setTimeout(() => {
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100); // Small delay for render completion
  }
}, [comments]); // Re-run when comments load
```

---

### Phase 6: E2E Tests (60 mins)

**File**: `tests/e2e/notification-navigation.spec.ts` (NEW)

**Test scenarios**:
1. ✅ Same-project notification → Opens modal in same window with comments tab
2. ✅ Cross-project notification → Opens modal in new tab with comments tab
3. ✅ Notification marked as read before navigation
4. ✅ Comment scrolls into view after tab switch
5. ✅ Unread count decrements after click
6. ✅ Rapid clicks don't cause multiple navigations

**Example test**:
```typescript
test('same-project notification opens modal with comments tab', async ({ page }) => {
  // Setup: Create notification for same project
  const notification = await createTestNotification({ projectId: 1, ticketKey: 'ABC-123' });

  // Navigate to project board
  await page.goto('/projects/1');

  // Click notification
  await page.getByTestId('notification-item').first().click();

  // Assert: Modal opens with comments tab active
  await expect(page.getByTestId('ticket-detail-modal')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Conversation' })).toHaveAttribute('aria-selected', 'true');

  // Assert: Comment is visible (scrolled into view)
  const comment = page.getByTestId(`comment-${notification.commentId}`);
  await expect(comment).toBeInViewport();
});
```

**Run tests**:
```bash
bun run test:e2e tests/e2e/notification-navigation.spec.ts
```

---

## Validation Checklist

Before marking feature complete, verify:

### Functional Requirements
- [ ] FR-001: System detects same-project vs cross-project
- [ ] FR-002: Same-project navigation uses same window
- [ ] FR-003: Cross-project navigation opens new tab
- [ ] FR-004: Modal auto-opens with comments tab selected
- [ ] FR-005: Comment scrolls into view
- [ ] FR-006: Notification marked as read before navigation
- [ ] FR-007: Current board state preserved (same-project)
- [ ] FR-008: Deleted tickets show error message
- [ ] FR-009: Access denied handled gracefully
- [ ] FR-010: Unread count updates immediately

### Success Criteria
- [ ] SC-001: Access comment in under 2 clicks (1 click on notification)
- [ ] SC-002: Same-project navigation has no page reload
- [ ] SC-003: Cross-project notifications open new tab 100%
- [ ] SC-004: Conversation tab auto-selected 100%
- [ ] SC-005: Comment visible in viewport within 1 second
- [ ] SC-006: Notification marked read before modal opens (no race)
- [ ] SC-007: Unread count updates within 200ms
- [ ] SC-008: Zero user confusion about project/ticket context

### Code Quality
- [ ] All TypeScript strict mode checks pass
- [ ] No `any` types used
- [ ] All functions have unit tests (Vitest)
- [ ] All user flows have E2E tests (Playwright)
- [ ] Error handling for network failures
- [ ] Loading states for async operations
- [ ] Accessibility: keyboard navigation works
- [ ] Accessibility: screen reader announcements correct

---

## Quick Commands

```bash
# Development
bun run dev

# Type checking
bun run type-check

# Run unit tests (fast)
bun run test:unit

# Run E2E tests
bun run test:e2e

# Run all tests
bun run test

# Watch mode (development)
bun run test:unit:watch
```

---

## Debugging Tips

### Notification not marking as read?
- Check browser DevTools Network tab for `/api/notifications/{id}/read` request
- Verify response is 200 OK with `success: true`
- Check TanStack Query DevTools for cache updates

### Modal not opening with comments tab?
- Check URL has `?tab=comments` parameter
- Verify `initialTab` prop is being passed to modal
- Check modal's useEffect dependencies (line 198-206 in ticket-detail-modal.tsx)

### Comment not scrolling?
- Check URL has `#comment-{id}` hash
- Verify comment element has matching `id` attribute
- Check ConversationTimeline renders before scroll attempt (add 100ms delay)

### Cross-project navigation not working?
- Check browser console for popup blocker warnings
- Verify `window.open()` includes `noopener,noreferrer` flags
- Test `isSameProject()` logic with console.log

### Race condition on rapid clicks?
- Add `pointer-events: none` during navigation
- Check `isPending` state from mutation
- Verify click handler exits early if already pending

---

## Architecture Decisions (from Research)

1. **Navigation**: Hybrid approach (same window vs new tab based on project)
2. **Tab selection**: URL query param (`?tab=comments`) + state prop
3. **Scroll**: Browser anchor + useEffect fallback
4. **Mark-as-read**: Before navigation (optimistic update)
5. **Race prevention**: Disable click handlers during navigation
6. **URL structure**: `/projects/{id}/tickets/{key}?modal=open&tab=comments#comment-{id}`

See `research.md` for full rationale and alternatives considered.

---

## File Tree (What Changes)

```
app/
├── api/
│   └── notifications/
│       └── [id]/
│           └── read/
│               └── route.ts               ← CREATE (API endpoint)
└── components/
    └── notifications/
        └── notification-dropdown.tsx      ← MODIFY (add navigation logic)

components/
├── board/
│   └── board.tsx                          ← MODIFY (URL parsing, initialTab)
└── ticket/
    └── conversation-timeline.tsx          ← MODIFY (scroll to comment)

lib/
├── utils/
│   └── navigation-utils.ts                ← CREATE (helpers)
└── validations/
    └── notification.ts                    ← CREATE (Zod schemas)

tests/
├── unit/
│   └── navigation-utils.test.ts           ← CREATE (Vitest)
└── e2e/
    └── notification-navigation.spec.ts    ← CREATE (Playwright)

specs/AIB-80-show-ticket-conversation/
├── spec.md                                ← REFERENCE ONLY
├── plan.md                                ← REFERENCE ONLY
├── research.md                            ← REFERENCE ONLY
├── data-model.md                          ← REFERENCE ONLY
├── quickstart.md                          ← THIS FILE
└── contracts/
    ├── api-spec.yaml                      ← REFERENCE ONLY
    └── interfaces.ts                      ← REFERENCE ONLY
```

---

## Estimated Timeline

| Phase | Task | Time | Cumulative |
|-------|------|------|------------|
| 1 | Utility functions + tests | 30 min | 30 min |
| 2 | API endpoint | 20 min | 50 min |
| 3 | Notification component | 45 min | 95 min |
| 4 | Board URL parsing | 30 min | 125 min |
| 5 | Comment scroll | 20 min | 145 min |
| 6 | E2E tests | 60 min | 205 min |
| - | **Total** | **~3.5 hours** | - |

**Note**: Timeline assumes familiarity with codebase and TDD workflow.

---

## Next Steps After Implementation

1. Run full test suite: `bun test`
2. Manual QA testing:
   - Test same-project notification click
   - Test cross-project notification click
   - Test rapid clicks (race condition)
   - Test keyboard navigation (accessibility)
   - Test on mobile viewport
3. Code review checklist:
   - TypeScript strict mode passes
   - No console.log statements left
   - Error handling complete
   - Tests cover edge cases
4. Deploy to preview environment
5. Update CLAUDE.md if new patterns introduced
6. Close ticket and move to SHIP stage

---

## Support

- **Documentation**: See `research.md` for technical decisions
- **Data model**: See `data-model.md` for entity details
- **API contract**: See `contracts/api-spec.yaml` for endpoint specs
- **Type definitions**: See `contracts/interfaces.ts` for TypeScript types
