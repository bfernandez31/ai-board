# Component Interface Contract: TicketDetailModal

**Feature**: 005-add-ticket-detail
**Component**: TicketDetailModal
**Date**: 2025-10-01

## Component Signature

### TicketDetailModal

**File**: `/components/board/ticket-detail-modal.tsx`

**Interface**:
```typescript
interface TicketDetailModalProps {
  /** The ticket to display in the modal. When null, modal should not render content. */
  ticket: Ticket | null;

  /** Controls the visibility of the modal dialog. */
  open: boolean;

  /** Callback fired when the modal requests to be closed (via close button, ESC, or overlay click). */
  onOpenChange: (open: boolean) => void;
}

export function TicketDetailModal(props: TicketDetailModalProps): JSX.Element;
```

**Usage Example**:
```typescript
import { TicketDetailModal } from '@/components/board/ticket-detail-modal';

function BoardPage() {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setSelectedTicket(null);
    }
  };

  return (
    <>
      {/* Board content */}
      <TicketDetailModal
        ticket={selectedTicket}
        open={isModalOpen}
        onOpenChange={handleModalClose}
      />
    </>
  );
}
```

## Prop Specifications

### `ticket: Ticket | null` (Required)

**Type**: `Ticket | null`

**Description**: The ticket object to display in the modal. When `null`, the modal content should not render.

**Shape**:
```typescript
interface Ticket {
  id: number;
  title: string;
  description: string;
  stage: 'INBOX' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
```

**Constraints**:
- Must be a valid Ticket object or null
- All Ticket fields are required (from Prisma schema)
- Dates must be valid Date objects

**Behavior**:
- When `null`: Modal content is not rendered (Dialog remains closed)
- When valid Ticket: Modal displays ticket details

### `open: boolean` (Required)

**Type**: `boolean`

**Description**: Controls the visibility state of the modal dialog.

**Values**:
- `true`: Modal is visible
- `false`: Modal is hidden

**Behavior**:
- Controls the `open` prop of the underlying Dialog component
- Must be managed by parent component
- Changes trigger animations (open/close transitions)

### `onOpenChange: (open: boolean) => void` (Required)

**Type**: `(open: boolean) => void`

**Description**: Callback function invoked when the modal requests a state change.

**Parameters**:
- `open: boolean`: The requested new state

**When Called**:
- Close button clicked: `onOpenChange(false)`
- ESC key pressed: `onOpenChange(false)`
- Overlay clicked: `onOpenChange(false)`
- Programmatic close: `onOpenChange(false)`

**Parent Responsibility**:
- Update the `open` state
- Optionally clear the `ticket` state
- Handle any cleanup or side effects

**Example Implementation**:
```typescript
const handleOpenChange = (open: boolean) => {
  setIsModalOpen(open);
  if (!open) {
    setSelectedTicket(null);  // Clear selection on close
  }
};
```

## Display Contract

### Modal Structure

**Layout**:
```
┌─────────────────────────────────────────────┐
│ [Close Button X]                            │
│                                              │
│ [Ticket Title - Large, Bold]                │
│                                              │
│ [Stage Badge]                                │
│                                              │
│ Description:                                 │
│ [Full description text, scrollable if long] │
│                                              │
│ Created: [formatted date]                    │
│ Last Updated: [formatted date]               │
└─────────────────────────────────────────────┘
```

### Visual Elements

**Title**:
- Font size: `text-2xl` (24px)
- Font weight: `font-bold`
- Color: `text-zinc-100`
- Max lines: None (full title displayed)
- Overflow: Word wrap

**Stage Badge**:
- Component: `<Badge>` from shadcn/ui
- Color mapping:
  - INBOX: `bg-zinc-600 text-zinc-50`
  - PLAN: `bg-blue-600 text-blue-50`
  - BUILD: `bg-green-600 text-green-50`
  - VERIFY: `bg-orange-600 text-orange-50`
  - SHIP: `bg-purple-600 text-purple-50`

**Description**:
- Label: "Description:" in `text-sm text-zinc-400`
- Content: `text-base text-zinc-200`
- Max height: `max-h-96` with `overflow-y-auto` for scrolling
- Line height: `leading-relaxed` for readability

**Dates**:
- Label format: "Created:" and "Last Updated:"
- Label style: `text-sm text-zinc-400`
- Date format: `MMM d, yyyy h:mm a` (e.g., "Oct 1, 2025 2:30 PM")
- Date style: `text-sm text-zinc-200`
- Library: `date-fns`

**Close Button**:
- Position: Top-right corner
- Icon: X icon from lucide-react
- Style: `text-zinc-400 hover:text-zinc-100`
- Size: `h-6 w-6`
- Accessible label: `aria-label="Close"`

### Responsive Behavior

**Mobile (<768px)**:
- Full-screen modal: `h-screen w-screen`
- No border radius
- Padding: `p-6`
- Close button: Fixed top-right

**Desktop (≥768px)**:
- Centered modal: `max-w-2xl`
- Auto height: `h-auto`
- Border radius: `rounded-lg`
- Padding: `p-8`
- Max height: `max-h-[90vh]` to prevent overflow

**Implementation**:
```typescript
<DialogContent className="h-screen w-screen sm:h-auto sm:max-w-2xl sm:rounded-lg">
  {/* Content */}
</DialogContent>
```

## Interaction Contract

### Opening Modal

**Trigger**: Parent component sets `open={true}` and provides valid `ticket`

**Behavior**:
1. Modal overlay fades in (backdrop: `bg-black/50`)
2. Modal content slides in / fades in (built-in Dialog animation)
3. Focus moves to close button
4. Body scroll is disabled (handled by Dialog)
5. ESC key listener is activated

**Accessibility**:
- Focus trap within modal
- First focusable element: Close button
- `role="dialog"` and `aria-modal="true"` (handled by Radix UI)

### Closing Modal

**Triggers**:
1. Close button click
2. ESC key press
3. Overlay click (outside modal content)

**Behavior**:
1. Calls `onOpenChange(false)`
2. Modal content slides out / fades out
3. Modal overlay fades out
4. Focus returns to trigger element (handled by Dialog)
5. Body scroll is re-enabled

**Parent Response**:
- Update `open` state to `false`
- Clear `ticket` state (recommended)

### Keyboard Navigation

**Supported Keys**:
- `ESC`: Close modal
- `Tab`: Navigate through focusable elements (close button only in this case)
- `Shift+Tab`: Reverse tab order

**Focus Management**:
- On open: Focus close button
- On close: Return focus to ticket card that opened modal

## Accessibility Contract

**ARIA Attributes**:
- Dialog: `role="dialog"`, `aria-modal="true"`
- Close button: `aria-label="Close"`
- Title: `aria-labelledby` pointing to title element

**Keyboard Support**:
- ESC key closes modal ✅
- Focus trap within modal ✅
- Tab navigation functional ✅

**Screen Reader Support**:
- Modal announced as dialog
- Title read first
- All content readable in logical order
- Close button discoverable

**Color Contrast**:
- Text on background: >4.5:1 ratio (WCAG AA)
- Dark theme: Zinc palette ensures contrast

## Error Handling Contract

### Invalid Ticket Data

**Case 1: ticket is null**
```typescript
if (!ticket) {
  return null;  // Don't render modal content
}
```

**Case 2: Missing required fields**
```typescript
// Should not occur with Prisma types, but defensive:
const title = ticket.title || 'Untitled';
const description = ticket.description || 'No description provided';
```

**Case 3: Invalid dates**
```typescript
const formatDate = (date: Date) => {
  try {
    return format(new Date(date), 'MMM d, yyyy h:mm a');
  } catch {
    return 'Invalid date';
  }
};
```

### Component Errors

**Error Boundary**: Not required (simple display component, no complex logic)

**Fallback Behavior**: If rendering fails, Dialog's built-in error handling prevents app crash

## Performance Contract

**Rendering**:
- Only renders when `open === true`
- No heavy computations
- No network requests
- Fast initial render (<100ms)

**Re-rendering**:
- Only re-renders when props change
- No unnecessary re-renders from parent

**Memory**:
- Minimal memory footprint (<10KB)
- No memory leaks (Dialog handles cleanup)

## Testing Contract

### Unit Tests (Not Required)
Component is simple enough that E2E tests provide sufficient coverage.

### E2E Tests (Required)

**File**: `/tests/ticket-detail-modal.spec.ts`

**Test Cases**:
1. ✅ Modal opens when ticket card clicked
2. ✅ Modal displays correct ticket data (title, description, stage, dates)
3. ✅ Close button closes modal
4. ✅ ESC key closes modal
5. ✅ Click outside closes modal
6. ✅ Modal is full-screen on mobile
7. ✅ Modal is centered on desktop
8. ✅ Long description scrolls properly

## Dependencies

**Required Components**:
- `Dialog`, `DialogContent`, `DialogTitle`, `DialogClose` from `@/components/ui/dialog`
- `Badge` from `@/components/ui/badge`

**Required Libraries**:
- `date-fns` for date formatting
- `lucide-react` for close icon

**Required Types**:
- `Ticket` from `@prisma/client` or `@/lib/types`

## Versioning

**Initial Version**: 1.0.0

**Future Compatibility**:
- If Ticket schema changes, component must be updated to reflect new fields
- Component interface should remain stable (no breaking changes to props)

## Notes

- This component is **read-only** - no editing functionality
- This component is **stateless** - all state managed by parent
- This component is **reusable** - can be used anywhere a ticket detail view is needed
- This component follows **shadcn/ui patterns** - composable, accessible, styled with Tailwind
