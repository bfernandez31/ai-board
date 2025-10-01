# Research: Ticket Detail Modal

**Feature**: 005-add-ticket-detail
**Date**: 2025-10-01
**Status**: Complete

## Overview
Research for implementing a read-only ticket detail modal using shadcn/ui Dialog component in Next.js 15 with React 18.

## Technology Decisions

### 1. Modal Component Library
**Decision**: shadcn/ui Dialog component (built on Radix UI)

**Rationale**:
- Already installed and used in project (`@radix-ui/react-dialog` in package.json)
- Provides accessible modal with keyboard navigation (ESC key support)
- Built-in overlay and click-outside-to-close functionality
- Responsive by default with customizable styling
- Follows WAI-ARIA patterns for accessibility
- Dark theme compatible with existing TailwindCSS setup

**Alternatives Considered**:
- Custom modal implementation: Rejected due to accessibility complexity and reinventing the wheel
- React Modal library: Rejected as shadcn/ui Dialog is already available and better integrated

### 2. State Management for Modal Open/Close
**Decision**: React useState hook with callback props

**Rationale**:
- Simple local state management for modal visibility
- Parent component (Board or TicketCard) controls which ticket to display
- No global state needed as modal state is ephemeral
- Follows React best practices and existing codebase patterns

**Alternatives Considered**:
- URL-based state (query params): Rejected as overkill for simple modal, adds complexity
- Global state management: Rejected as modal state is local and temporary
- Context API: Rejected as prop drilling is minimal (1-2 levels)

### 3. Responsive Behavior
**Decision**: TailwindCSS breakpoint classes + Dialog props

**Rationale**:
- Mobile (<768px): Use `DialogContent` with full-screen classes (`h-screen w-screen`)
- Desktop (≥768px): Use centered modal with max-width
- TailwindCSS provides `sm:`, `md:`, `lg:` breakpoints
- Dialog component supports custom className for responsive styling

**Implementation Pattern**:
```typescript
// Pseudo-code for responsive dialog
<DialogContent className="h-screen w-screen sm:h-auto sm:max-w-2xl sm:rounded-lg">
  {/* Modal content */}
</DialogContent>
```

**Alternatives Considered**:
- Separate mobile/desktop components: Rejected as single component with responsive classes is simpler
- JavaScript-based media queries: Rejected as TailwindCSS handles this declaratively

### 4. Date Formatting
**Decision**: date-fns library

**Rationale**:
- Already installed in project (package.json shows `date-fns ^4.1.0`)
- Lightweight and modular (tree-shakeable)
- Good TypeScript support
- Common formatting patterns for "Created" and "Updated" dates
- Format: `format(date, 'MMM d, yyyy h:mm a')` → "Oct 1, 2025 2:30 PM"

**Alternatives Considered**:
- Native Intl.DateTimeFormat: More verbose, less flexible formatting
- Moment.js: Rejected as deprecated and date-fns is already available
- Day.js: Not installed, would add unnecessary dependency

### 5. Click Handler Integration
**Decision**: Add onClick handler to TicketCard component

**Rationale**:
- TicketCard already exists with drag-and-drop functionality
- Need to prevent drag from triggering click (check if dragging)
- Pass ticket data via callback prop to parent
- Parent manages modal state and selected ticket

**Implementation Pattern**:
```typescript
// In TicketCard
const handleClick = (e: React.MouseEvent) => {
  if (!isDragging) {
    onTicketClick?.(ticket);
  }
};

// In parent (Board component)
const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
```

**Alternatives Considered**:
- Modal inside TicketCard: Rejected as violates separation of concerns
- Event delegation from Board: More complex, no significant benefit

### 6. Dark Theme Styling
**Decision**: Existing TailwindCSS dark theme utilities

**Rationale**:
- Project already uses dark theme (`bg-zinc-900`, `border-zinc-700` patterns)
- Dialog overlay: `bg-black/50` for semi-transparent backdrop
- Dialog content: `bg-zinc-900 border-zinc-700 text-zinc-100`
- Consistent with existing TicketCard and Board styling

**Style Reference**:
- Background: `bg-zinc-900`
- Borders: `border-zinc-700`
- Text: `text-zinc-100` (primary), `text-zinc-400` (secondary)
- Close button: `text-zinc-400 hover:text-zinc-100`

### 7. Performance Considerations
**Decision**: No optimizations needed initially

**Rationale**:
- Modal renders on-demand (only when open)
- Minimal component tree (Dialog + content elements)
- No complex calculations or heavy rendering
- React.memo not needed as modal is not frequently re-rendered
- Existing ticket data already loaded (no additional API calls)

**Future Optimizations** (if needed):
- Lazy load modal component with React.lazy
- Virtualize long descriptions if performance issues arise
- Add React.memo if parent re-renders become frequent

### 8. Testing Strategy
**Decision**: Playwright E2E tests following TDD approach

**Rationale**:
- Project uses Playwright (package.json shows `@playwright/test ^1.48.0`)
- Test critical user flows before implementation
- E2E tests validate entire interaction (click → open → display → close)
- Existing test patterns in project to follow

**Test Scenarios**:
1. Click ticket card → modal opens with correct data
2. Close button → modal closes
3. ESC key → modal closes
4. Click outside → modal closes
5. Mobile viewport → full-screen display
6. Desktop viewport → centered modal
7. Long title/description → proper text wrapping/truncation

## Implementation Dependencies

### Required Files (Existing)
- `/components/ui/dialog.tsx` - shadcn Dialog component ✅
- `/components/board/ticket-card.tsx` - Ticket card to modify ✅
- `/lib/types.ts` - TypeScript types (TicketWithVersion) ✅
- `/prisma/schema.prisma` - Ticket model ✅

### Required Files (New)
- `/components/board/ticket-detail-modal.tsx` - Modal component
- `/tests/ticket-detail-modal.spec.ts` - E2E tests

### No Changes Required
- API routes (using existing ticket data)
- Database schema (read-only operations)
- Authentication (no new security concerns)

## Best Practices Applied

### Accessibility
- Semantic HTML: `<dialog>` pattern via Radix UI
- Keyboard navigation: ESC key, focus trap inside modal
- Screen reader support: aria-labels, role attributes
- Focus management: Focus close button on open, restore focus on close

### TypeScript
- Strict mode compliance
- Explicit prop types for modal component
- Type guard for selectedTicket (null check)
- Event handler types for onClick, onClose

### React Patterns
- Controlled component pattern for modal state
- Callback props for communication (onClose, onTicketClick)
- Client Component directive (`"use client"`) for interactivity
- Proper cleanup in useEffect if needed (none required here)

### Performance
- Conditional rendering (modal only when open)
- No unnecessary re-renders
- Efficient event handling
- Minimal DOM nodes

## Risks and Mitigations

### Risk 1: Drag-and-drop conflicts with click
**Mitigation**: Check `isDragging` state before triggering modal open

### Risk 2: Long descriptions breaking layout
**Mitigation**: CSS overflow handling (`overflow-y-auto`, max-height)

### Risk 3: Mobile full-screen causing confusion
**Mitigation**: Clear visual indicators (close button top-right, familiar pattern)

### Risk 4: Stage badge styling inconsistency
**Mitigation**: Reuse existing Badge component with same colors as TicketCard

## References

### Documentation
- shadcn/ui Dialog: https://ui.shadcn.com/docs/components/dialog
- Radix UI Dialog: https://www.radix-ui.com/primitives/docs/components/dialog
- Next.js App Router: https://nextjs.org/docs/app
- TailwindCSS Responsive Design: https://tailwindcss.com/docs/responsive-design
- date-fns format: https://date-fns.org/docs/format

### Existing Code Patterns
- Ticket card styling: `/components/board/ticket-card.tsx`
- Badge component: `/components/ui/badge.tsx`
- Dialog component: `/components/ui/dialog.tsx`
- Board component: `/components/board/board.tsx`

## Conclusion

All technical decisions are aligned with existing project architecture and constitutional principles. No NEEDS CLARIFICATION items remain. Ready to proceed to Phase 1 (Design & Contracts).
