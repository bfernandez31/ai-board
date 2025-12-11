# Research: Duplicate a Ticket

**Date**: 2025-12-11
**Feature**: AIB-105-duplicate-a-ticket

## Research Tasks

### 1. Button Placement in Modal Header

**Decision**: Place duplicate button in the metadata row alongside stage badge and policy badge

**Rationale**:
- The ticket-detail-modal.tsx already has a compact metadata row (lines 720-792) containing ticket key, stage badge, policy badge, branch link, and "Edit Policy" button
- Following this established pattern ensures UI consistency
- The duplicate action is a secondary action (not as common as editing), so placing it alongside other secondary actions (like Edit Policy) is appropriate
- Using a compact icon button with tooltip matches the existing "Edit Policy" button pattern

**Alternatives Considered**:
- Full-width action bar at bottom: Rejected - takes too much vertical space, less discoverable
- Dropdown menu for actions: Rejected - adds extra click, over-engineering for single action
- Three-dot menu: Rejected - hides functionality, not consistent with current UI

### 2. Title Truncation Logic

**Decision**: Create a pure utility function for title truncation with "Copy of " prefix

**Rationale**:
- Title max length is 100 characters (from CreateTicketSchema validation)
- "Copy of " prefix is 8 characters
- If original title + prefix exceeds 100 chars, truncate original title to fit
- Pure function enables easy unit testing with Vitest

**Implementation**:
```typescript
// lib/utils/ticket-title.ts
export function createDuplicateTitle(originalTitle: string, maxLength: number = 100): string {
  const prefix = 'Copy of ';
  const maxOriginalLength = maxLength - prefix.length;
  const truncatedTitle = originalTitle.length > maxOriginalLength
    ? originalTitle.slice(0, maxOriginalLength)
    : originalTitle;
  return `${prefix}${truncatedTitle}`;
}
```

**Alternatives Considered**:
- Append " (copy)" suffix: Rejected - less standard, creates issues with multiple copies
- Add timestamp: Rejected - not user-friendly, makes titles very long
- Increment number "Copy 2 of": Rejected - over-engineering for first iteration

### 3. API Endpoint Pattern

**Decision**: Create new POST endpoint at `/api/projects/[projectId]/tickets/[id]/duplicate`

**Rationale**:
- Follows existing nested resource pattern (e.g., `/tickets/[id]/transition`, `/tickets/[id]/comments`)
- POST is appropriate since it creates a new resource
- Returns the newly created ticket with all fields (matching POST /tickets response format)
- Uses existing `verifyProjectAccess` helper for authorization
- Calls existing `createTicket` function internally for consistency

**Alternatives Considered**:
- Add query param to POST /tickets: Rejected - unclear semantics, mixes create and duplicate
- PUT endpoint: Rejected - PUT implies updating, not creating
- Add `duplicate` field to PATCH: Rejected - PATCH is for updates, not creates

### 4. Attachment Handling

**Decision**: Reference same Cloudinary URLs without re-uploading

**Rationale**:
- Spec decision (AUTO → CONSERVATIVE) recommended reference approach is simpler
- No additional Cloudinary API calls needed
- Faster duplicate operation (meets <2s perceived completion goal)
- Attachments array structure already supports this - just copy the JSON array

**Implementation Detail**:
```typescript
// Copy attachments directly - same URL references
const duplicateAttachments = sourceTicket.attachments ? [...sourceTicket.attachments] : [];
```

**Alternatives Considered**:
- Re-upload to new Cloudinary paths: Rejected - slower, more complex, costs more storage
- Deep copy with new cloudinaryPublicId: Rejected - not needed since we're referencing same files

### 5. Toast Notification with Action

**Decision**: Use existing toast pattern with "View" action button

**Rationale**:
- Toast already supports `action` prop for actionable notifications
- Action should navigate to board with new ticket modal open
- Uses existing URL pattern: `/projects/[id]/board?ticket=[ticketId]&tab=details`

**Implementation Pattern**:
```typescript
toast({
  title: 'Ticket duplicated',
  description: newTicket.ticketKey,
  action: (
    <ToastAction altText="View duplicated ticket" onClick={() => navigate(...)}>
      View
    </ToastAction>
  ),
});
```

**Alternatives Considered**:
- Plain toast without action: Rejected - spec requires navigation action (FR-010)
- Auto-navigate after duplicate: Rejected - disruptive if user wants to stay on current ticket

### 6. Button Disable During Request

**Decision**: Use local `isLoading` state to disable button during API call

**Rationale**:
- Prevents double-submission (edge case from spec)
- Simple useState pattern, no need for external state management
- Button shows loading state (spinner or disabled appearance)

**Implementation Pattern**:
```typescript
const [isDuplicating, setIsDuplicating] = useState(false);

const handleDuplicate = async () => {
  setIsDuplicating(true);
  try {
    const response = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/duplicate`, {
      method: 'POST',
    });
    // ... handle response
  } finally {
    setIsDuplicating(false);
  }
};
```

**Alternatives Considered**:
- TanStack Query mutation: Rejected - overkill for single operation, no caching needed
- Debounce: Rejected - doesn't prevent rapid clicks during API call

### 7. Testing Strategy

**Decision**: Vitest for title utility, Playwright for E2E flow

**Rationale**:
- Constitution principle III mandates hybrid testing strategy
- Title truncation is a pure function - perfect for Vitest unit tests
- Duplicate flow involves UI interaction, API calls, toast - needs Playwright E2E

**Test Files**:
- `tests/unit/ticket-title.test.ts`: Unit tests for `createDuplicateTitle()`
- `tests/e2e/duplicate-ticket.spec.ts`: E2E tests for full duplicate flow

**Alternatives Considered**:
- All Playwright: Rejected - constitution requires unit tests for pure functions
- React Testing Library: Rejected - not in tech stack, Playwright handles component testing

## Resolved Unknowns

All "NEEDS CLARIFICATION" items from Technical Context have been resolved:

1. **Button placement** → Metadata row in modal header
2. **Title format** → "Copy of " prefix with truncation
3. **API pattern** → New `/duplicate` POST endpoint
4. **Attachment handling** → Reference same URLs
5. **Toast pattern** → Existing toast with action button
6. **Loading state** → Local useState pattern
7. **Testing approach** → Vitest unit + Playwright E2E
