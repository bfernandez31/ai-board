# Quickstart: Close Ticket Feature

**Feature**: AIB-147-close-ticket-feature
**Date**: 2026-01-06

## Implementation Order

### Phase 1: Schema & Core Logic

1. **Prisma Schema Migration**
   - Add `CLOSED` to Stage enum
   - Add `closedAt` DateTime? to Ticket model
   - Run `prisma migrate dev`

2. **Stage Transitions Update** (`lib/stage-transitions.ts`)
   - Add `CLOSED` to Stage enum
   - Update `isTerminalStage()` to include CLOSED
   - Add `isCloseTransition()` helper

3. **PR Closure Utility** (`lib/github/close-prs-only.ts`)
   - Implement `closePRsOnly()` function
   - Reuse Octokit patterns from `delete-branch-and-prs.ts`
   - Add closure comment support

### Phase 2: API Layer

4. **Transition Endpoint Update** (`app/api/.../transition/route.ts`)
   - Add CLOSED to Zod schema
   - Handle VERIFY → CLOSED transition
   - Integrate PR closure with retry logic
   - Set `closedAt` timestamp

5. **Search Endpoint Update** (`app/api/.../search/route.ts`)
   - Include `closedAt` in select fields
   - No filter changes needed (already returns all stages)

6. **Ticket Fetch Update** (`lib/db/tickets.ts`)
   - Add board exclusion filter for CLOSED

### Phase 3: UI Components

7. **Close Confirmation Modal** (`components/board/close-confirmation-modal.tsx`)
   - Implement using AlertDialog pattern
   - Display ticket key and consequences
   - "Close Ticket" (destructive) + "Cancel" buttons

8. **Dual Drop Zone** (`components/board/stage-column.tsx`)
   - Detect drag from VERIFY
   - Conditional render: ShipZone + CloseZone
   - Proper styling per spec

9. **Board Integration** (`components/board/board.tsx`)
   - Handle Close zone drop
   - Open confirmation modal
   - Optimistic update on confirm

10. **Search Results Styling**
    - Add closedAt to search result type
    - Muted styling for CLOSED tickets
    - "Closed" badge component

11. **Read-Only Modal**
    - Add `isReadOnly` logic for CLOSED stage
    - Disable form fields
    - Show closure date banner

### Phase 4: Tests

12. **Unit Tests** (`tests/unit/stage-validation.test.ts`)
    - CLOSED as terminal stage
    - VERIFY → CLOSED valid
    - CLOSED → any invalid

13. **Integration Tests** (`tests/integration/tickets/`)
    - Close transition API
    - Validation blocking
    - Search including CLOSED

14. **E2E Tests** (`tests/e2e/board/`)
    - Dual drop zone appearance
    - Confirmation modal flow
    - Ticket removal from board

## Key Files Reference

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | MODIFY | Add CLOSED enum, closedAt field |
| `lib/stage-transitions.ts` | MODIFY | CLOSED stage logic |
| `lib/github/close-prs-only.ts` | NEW | PR closure without branch delete |
| `app/api/.../transition/route.ts` | MODIFY | Handle VERIFY→CLOSED |
| `components/board/close-confirmation-modal.tsx` | NEW | Confirmation dialog |
| `components/board/stage-column.tsx` | MODIFY | Dual drop zones |
| `components/board/board.tsx` | MODIFY | Close zone handling |

## Testing Commands

```bash
# Run all tests
bun run test

# Unit tests only (stage validation)
bun run test:unit tests/unit/stage-validation.test.ts

# Integration tests (API)
bun run test:integration tests/integration/tickets/

# E2E tests (drag-drop)
bun run test:e2e tests/e2e/board/close-ticket.spec.ts
```

## Validation Checklist

- [ ] CLOSED added to Stage enum in Prisma
- [ ] Migration runs without errors
- [ ] `closedAt` field populated on close
- [ ] PRs closed with comment
- [ ] Branch preserved (not deleted)
- [ ] Dual drop zones appear for VERIFY tickets
- [ ] Confirmation modal shows consequences
- [ ] Closed tickets excluded from board
- [ ] Closed tickets appear in search (muted)
- [ ] Closed ticket modal is read-only
- [ ] Active job blocks closure
- [ ] Cleanup lock blocks closure
