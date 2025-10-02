# Research Document: Inline Ticket Editing

**Feature**: 007-enable-inline-editing
**Date**: 2025-10-02
**Status**: Complete

## Overview
This document consolidates research findings for implementing inline editing of ticket title and description within the ticket detail modal. All technical decisions are informed by existing project architecture, constitutional principles, and React/Next.js best practices.

---

## Decision 1: Inline Editing UX Pattern

### Research Question
What are React best practices for inline editing with keyboard navigation (Enter/ESC)?

### Options Evaluated

**Option A: Controlled Input with Custom Hook**
- Local state management via `useState`
- Keyboard event handlers via `useEffect`
- Explicit focus management with `useRef`
- Full control over validation and UX

**Option B: Uncontrolled Input with Form Handling**
- Uses native form submission
- Ref-based value access
- Less React overhead

**Option C: ContentEditable with Custom Component**
- Native-like editing experience
- Complex state synchronization
- Accessibility challenges

### Decision: **Option A - Controlled Input with Custom Hook**

**Rationale**:
- Provides precise control over Enter/ESC behavior required by spec
- Integrates seamlessly with React state for validation
- Enables optimistic updates and rollback patterns
- Better accessibility through controlled focus management
- Aligns with existing shadcn/ui Input/Textarea components (controlled pattern)

**Implementation Strategy**:
```typescript
// Custom hook for inline editing state management
function useInlineEdit(initialValue: string, onSave: (value: string) => Promise<void>) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);

  // Keyboard handlers for Enter/ESC
  // Focus management
  // Validation integration

  return { isEditing, value, ... };
}
```

**Alternatives Rejected**:
- **Option B**: Harder to implement real-time validation and character counting
- **Option C**: Accessibility concerns (ARIA support, screen readers), over-engineered for simple text fields

---

## Decision 2: Optimistic Concurrency Control

### Research Question
How to implement version-based optimistic locking with Prisma?

### Options Evaluated

**Option A: Prisma Conditional Update (Version Field)**
- `WHERE id = ? AND version = ?`
- Manual version increment on success
- Returns `null` on version mismatch
- Simple, database-agnostic

**Option B: Database Row-Level Locking**
- `SELECT FOR UPDATE` in transaction
- Prevents concurrent access
- More complex, database-specific

**Option C: Timestamp-Based Conflict Detection**
- Compare `updatedAt` timestamps
- Subject to clock skew issues
- Less reliable than version counter

### Decision: **Option A - Prisma Conditional Update**

**Rationale**:
- Existing Ticket model already has `version` field (no schema changes required)
- Prisma's `update` with compound `where` clause provides atomic check-and-update
- Returns `null` when version mismatch, enabling clean 409 Conflict response
- Aligns with constitutional Database Integrity principle (Prisma-first approach)
- Simple to test and reason about

**Implementation Strategy**:
```typescript
// API route: PATCH /api/tickets/[id]
const updated = await prisma.ticket.update({
  where: {
    id: ticketId,
    version: currentVersion  // Atomic check
  },
  data: {
    title,
    description,
    version: { increment: 1 }  // Atomic increment
  }
});

if (!updated) {
  return NextResponse.json(
    { error: "Conflict: Ticket was modified by another user" },
    { status: 409 }
  );
}
```

**Alternatives Rejected**:
- **Option B**: Overkill for this use case; adds complexity with transactions and locks
- **Option C**: Unreliable due to potential clock synchronization issues

---

## Decision 3: Character Counter Component

### Research Question
Best patterns for real-time character counting with warning states?

### Options Evaluated

**Option A: Separate Reusable Component with useMemo**
- Memoized count calculation
- ARIA live region for accessibility
- Reusable across title/description

**Option B: Inline Calculation**
- Direct character count in render
- No component overhead
- Potential re-render issues

**Option C: CSS-Only Counter**
- Uses CSS counters
- No JavaScript overhead
- No screen reader support

### Decision: **Option A - Separate Component with useMemo**

**Rationale**:
- Performance: `useMemo` prevents unnecessary recalculations
- Accessibility: ARIA live region announces count changes to screen readers
- Reusability: Single component for both title and description
- Aligns with constitutional Component-Driven Architecture principle
- Testable in isolation

**Implementation Strategy**:
```typescript
function CharacterCounter({
  current,
  max,
  warningThreshold = 0.9
}: CharacterCounterProps) {
  const state = useMemo(() => ({
    count: current,
    max,
    remaining: max - current,
    isWarning: current > max * warningThreshold,
    isError: current > max
  }), [current, max, warningThreshold]);

  return (
    <div aria-live="polite" aria-atomic="true">
      {state.remaining} characters remaining
      {state.isWarning && <WarningIcon />}
    </div>
  );
}
```

**Alternatives Rejected**:
- **Option B**: Risk of unnecessary re-renders on every keystroke
- **Option C**: Fails accessibility requirements (no screen reader support)

---

## Decision 4: Optimistic UI Updates

### Research Question
React patterns for optimistic updates with rollback on error?

### Options Evaluated

**Option A: Local State + Rollback on Error**
- Update local state immediately
- Call API in background
- Rollback + toast on error

**Option B: Wait for Server Confirmation**
- Only update after API success
- No rollback needed
- Slower perceived performance

**Option C: Optimistic with Error Boundary**
- Throw error on API failure
- Error boundary catches and resets
- More complex error handling

### Decision: **Option A - Local State with Rollback**

**Rationale**:
- Best UX: Immediate visual feedback (<100ms response time)
- Graceful degradation: Clear error communication via toast
- Simple implementation: Standard React state patterns
- Aligns with FR-023 (optimistic update) and FR-024 (rollback on error)
- Prevents user confusion: Original values restored on conflict

**Implementation Strategy**:
```typescript
async function handleSave(newValue: string) {
  const originalValue = ticket.title; // Save original

  // Optimistic update
  setTicket({ ...ticket, title: newValue });

  try {
    const response = await fetch(`/api/tickets/${ticket.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: newValue, version: ticket.version })
    });

    if (!response.ok) {
      throw new Error('Save failed');
    }

    // Success toast
    toast.success('Ticket updated');
  } catch (error) {
    // Rollback
    setTicket({ ...ticket, title: originalValue });
    toast.error('Failed to save. Changes reverted.');
  }
}
```

**Alternatives Rejected**:
- **Option B**: Violates performance goals (<100ms UI response); poor UX
- **Option C**: Over-engineered; error boundaries better for unhandled errors

---

## Architecture Integration

### Existing Components to Extend
- `components/board/ticket-detail-modal.tsx`: Add inline editing UI
- `components/board/board.tsx`: Refresh state after successful save
- `app/api/tickets/[id]/route.ts`: Add PATCH handler

### New Components to Create
- `lib/hooks/use-ticket-edit.ts`: Inline edit state management
- `lib/validations/ticket.ts`: Zod schemas for validation
- `components/ui/character-counter.tsx`: Reusable counter component

### Dependencies Already Available
- shadcn/ui Input, Textarea, Toast (existing)
- Zod 4.x for validation (existing)
- Prisma 6.x for database (existing)
- TypeScript strict mode (existing)

---

## Validation Requirements

### Title Validation
```typescript
const titleSchema = z.string()
  .trim()
  .min(1, "Title cannot be empty")
  .max(100, "Title must be 100 characters or less");
```

### Description Validation
```typescript
const descriptionSchema = z.string()
  .trim()
  .min(1, "Description cannot be empty")
  .max(1000, "Description must be 1000 characters or less");
```

### Version Validation
```typescript
const versionSchema = z.number().int().positive();
```

---

## Performance Considerations

### Target Metrics
- **UI Response**: <100ms for edit mode activation
- **API Response**: <500ms p95 for PATCH requests
- **Optimistic Update**: Immediate visual feedback
- **Character Counter**: <16ms re-render (60fps)

### Optimization Strategies
- `useMemo` for character counter calculations
- Debounce validation (if needed for complex rules)
- Optimistic updates for perceived performance
- Minimal re-renders via proper state management

---

## Accessibility Requirements

### Keyboard Navigation
- **Enter**: Save changes (title only)
- **ESC**: Cancel and restore original value
- **Tab**: Navigate between title and description

### Screen Reader Support
- ARIA live region for character counter
- Focus management on edit mode activation
- Error announcements via toast with role="alert"

### Visual Indicators
- Hover state: Pencil icon on title/description
- Edit state: Visual border change
- Warning state: Color change at 90% character limit
- Error state: Red border + inline error message

---

## Testing Strategy

### E2E Test Coverage (Playwright)
1. Title click → inline edit → Enter saves
2. Description click → inline edit → save button works
3. ESC cancels and restores original value
4. Character limits enforced (100 title, 1000 description)
5. Empty values rejected with error message
6. Optimistic update → API success → board refreshes
7. Concurrent edit conflict → 409 error → toast message
8. Network failure → rollback → error toast

### Contract Tests
- PATCH `/api/tickets/[id]` schema validation
- Request: `{ title?, description?, version }`
- Response: Updated ticket payload
- Error cases: 400 (validation), 404 (not found), 409 (conflict)

---

## Security Considerations

### Input Validation
- Server-side Zod validation (never trust client)
- Trim whitespace before validation
- Enforce length limits at database and API layer

### Concurrency Protection
- Version field prevents lost updates
- Atomic update operation via Prisma
- Clear conflict messaging to users

### Data Integrity
- Prisma parameterized queries (no SQL injection)
- Database constraints enforced (VARCHAR limits)
- Transaction ensures atomicity

---

## Summary

All research decisions align with:
- ✅ Constitutional principles (TypeScript-first, Component-Driven, TDD, Security-First, Database Integrity)
- ✅ Existing project architecture (Next.js App Router, shadcn/ui, Prisma)
- ✅ Functional requirements from spec (FR-001 through FR-028)
- ✅ Performance goals (<100ms UI, <500ms API, optimistic updates)

**No NEEDS CLARIFICATION remain**: All technical decisions finalized and ready for Phase 1 design.
