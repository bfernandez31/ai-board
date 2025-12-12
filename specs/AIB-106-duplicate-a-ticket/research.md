# Research: Duplicate Ticket Feature

**Branch**: `AIB-106-duplicate-a-ticket` | **Date**: 2025-12-12

## Research Tasks Completed

### 1. Title Prefix Pattern for Duplicates

**Decision**: Use "Copy of " prefix for duplicated ticket titles

**Rationale**:
- Industry-standard pattern (Google Docs, Figma, Notion all use "Copy of ")
- Clear indication to users that they're looking at a duplicate
- Spec explicitly requires this approach (FR-003)

**Alternatives Considered**:
- `(Copy)` suffix - rejected because it may truncate on long titles
- `[Duplicate]` prefix - rejected, too technical for end users
- No prefix - rejected, no visual distinction from original

**Implementation Note**: Must truncate original title if "Copy of " prefix would exceed 100 character limit (FR-011).

### 2. Attachment Handling Strategy

**Decision**: Copy attachment references (URLs), not re-upload files

**Rationale**:
- Uploaded images use Cloudinary URLs that are independently persistent
- External images are already references (no re-upload needed)
- Re-uploading would double storage costs with no benefit
- Spec confirms this approach (Auto-Resolved Decision on image copying)

**Alternatives Considered**:
- Deep copy (re-upload to Cloudinary) - rejected, unnecessary storage duplication
- No attachments in duplicate - rejected, violates FR-006

**Implementation Note**: Simply copy the `attachments` JSON array from source ticket.

### 3. API Endpoint Design

**Decision**: New dedicated endpoint `POST /api/projects/{projectId}/tickets/{id}/duplicate`

**Rationale**:
- Follows existing REST patterns in codebase (e.g., `/tickets/{id}/transition`)
- Clearly separates duplicate logic from create logic
- Allows specific authorization checks for source ticket access

**Alternatives Considered**:
- Extend POST `/tickets` with `sourceTicketId` parameter - rejected, muddies create semantics
- Client-side copy (read + create) - rejected, extra round-trip, race conditions

### 4. TanStack Query Integration

**Decision**: Use `useMutation` with `invalidateQueries` for optimistic board refresh

**Rationale**:
- Existing pattern used throughout codebase (see ticket transitions, comments)
- Provides built-in loading states, error handling
- Invalidating `tickets` query triggers board refresh automatically

**Reference Implementation**: `components/board/board.tsx` uses this pattern for stage transitions.

### 5. Button Placement in Modal

**Decision**: Place duplicate button in modal header metadata row (next to "Edit Policy" button)

**Rationale**:
- Consistent with existing action button placement
- Header row already contains Edit Policy button (visible in INBOX stage)
- Duplicate button should be visible in all stages (per FR-013)

**Reference**: `ticket-detail-modal.tsx:789-801` shows existing button pattern.

### 6. Test Strategy

**Decision**: Hybrid testing - Playwright E2E for user flow, Playwright API tests for contract

**Rationale**:
- Constitution requires TDD with hybrid Vitest/Playwright strategy
- Duplication involves UI interaction + API + database - integration test territory
- No pure utility functions being added (title truncation is simple enough to test via E2E)

**Test Files**:
- `tests/e2e/ticket-duplicate.spec.ts` - User journey tests
- `tests/api/tickets-duplicate.spec.ts` - API contract tests

## Patterns Identified from Codebase

### Existing API Route Pattern
```typescript
// From app/api/projects/[projectId]/tickets/[id]/transition/route.ts
export async function POST(request, context) {
  const { projectId, id } = await context.params;
  await verifyProjectAccess(projectId);
  // ... logic
  return NextResponse.json(result, { status: 200 });
}
```

### Existing Toast Pattern
```typescript
// From ticket-detail-modal.tsx
toast({
  title: 'Success',
  description: 'Ticket updated',
});

toast({
  variant: 'destructive',
  title: 'Error',
  description: 'Failed to save changes',
});
```

### Existing Button Pattern in Modal Header
```typescript
// From ticket-detail-modal.tsx:789-801
<Button
  variant="ghost"
  size="sm"
  onClick={() => setPolicyEditOpen(true)}
  className="ml-auto h-6 px-2 text-xs"
  data-testid="edit-policy-button"
  title="Edit clarification policy"
>
  <Settings2 className="w-3 h-3 mr-1" />
  Edit Policy
</Button>
```

## Open Questions Resolved

| Question | Resolution |
|----------|------------|
| Should duplicate button be disabled during pending jobs? | No - duplication creates a new ticket in INBOX, independent of source ticket state |
| What happens to `workflowType` field? | Reset to `FULL` - duplicate is a new ticket starting fresh |
| Should `autoMode` be copied? | No - reset to `false` for new ticket |
| Should `branch` be copied? | No - new ticket has no branch until workflow runs |
