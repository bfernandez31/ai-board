# Data Model: Ticket Detail Modal

**Feature**: 005-add-ticket-detail
**Date**: 2025-10-01
**Status**: Complete

## Overview
This feature uses the existing Ticket entity with no schema changes. The modal is a pure UI component that displays data without modifying it.

## Entities

### Ticket (Existing - No Changes)
**Source**: `/prisma/schema.prisma`

**Fields**:
```typescript
interface Ticket {
  id: number;           // Primary key, auto-increment
  title: string;        // VarChar(100), required
  description: string;  // VarChar(1000), required
  stage: Stage;         // Enum (INBOX, PLAN, BUILD, VERIFY, SHIP), default INBOX
  version: number;      // Integer, default 1 (for optimistic concurrency)
  createdAt: Date;      // Timestamp, auto-generated on creation
  updatedAt: Date;      // Timestamp, auto-updated on modification
}
```

**Stage Enum**:
```typescript
enum Stage {
  INBOX = "INBOX",
  PLAN = "PLAN",
  BUILD = "BUILD",
  VERIFY = "VERIFY",
  SHIP = "SHIP"
}
```

**Indexes**:
- `stage` (for filtering by stage)
- `updatedAt` (for sorting by recent activity)

**Validation Rules** (Existing):
- `title`: Max 100 characters, required
- `description`: Max 1000 characters, required
- `stage`: Must be valid Stage enum value
- `version`: Positive integer for optimistic locking

**Relationships**: None (standalone entity)

**State Transitions**: Not applicable for read-only modal

## Component State

### TicketDetailModal Component State
**Purpose**: Manage modal visibility and selected ticket

```typescript
interface TicketDetailModalProps {
  ticket: Ticket | null;      // Ticket to display, null when closed
  open: boolean;              // Modal visibility state
  onOpenChange: (open: boolean) => void;  // Callback for state changes
}
```

**State Flow**:
1. User clicks ticket card → Parent sets `ticket` and `open: true`
2. Modal renders with ticket data
3. User closes modal → `onOpenChange(false)` called → Parent sets `open: false`

### Parent Component State (Board or Page)
**Purpose**: Track selected ticket for modal

```typescript
interface BoardState {
  selectedTicket: Ticket | null;  // Currently selected ticket for modal
  // ... other board state
}
```

**State Management**:
- `useState` hook for `selectedTicket`
- Click handler: `setSelectedTicket(ticket)`
- Close handler: `setSelectedTicket(null)`

## Data Flow

### Read Operations Only
**No Write Operations**: This feature is read-only, no data mutations

**Data Source**:
- Existing API endpoint: `GET /api/tickets` (loads all tickets)
- Data already available in Board component
- No additional API calls needed for modal

**Data Flow Diagram**:
```
[Database] → [GET /api/tickets] → [Board Component State] → [TicketCard onClick]
→ [Parent State: selectedTicket] → [TicketDetailModal props] → [Display]
```

## TypeScript Types

### Existing Types (No Changes)
**File**: `/lib/types.ts`

```typescript
// Existing type from Prisma
type TicketWithVersion = Ticket & { version: number };

// Existing Stage enum
type Stage = 'INBOX' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP';
```

### New Types Required

```typescript
// Component prop types
interface TicketDetailModalProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Event handler types
type TicketClickHandler = (ticket: Ticket) => void;
type ModalCloseHandler = () => void;
```

## Display Transformations

### Date Formatting
**Input**: ISO 8601 string from database (`2025-10-01T14:30:00.000Z`)
**Output**: Human-readable format (`Oct 1, 2025 2:30 PM`)

**Implementation**:
```typescript
import { format } from 'date-fns';

const formatTicketDate = (date: Date): string => {
  return format(new Date(date), 'MMM d, yyyy h:mm a');
};
```

### Stage Display
**Input**: Stage enum value (`INBOX`, `PLAN`, etc.)
**Output**: Badge component with stage-specific styling

**Mapping**:
```typescript
const stageBadgeConfig: Record<Stage, { label: string; className: string }> = {
  INBOX: { label: 'Inbox', className: 'bg-zinc-600 text-zinc-50' },
  PLAN: { label: 'Plan', className: 'bg-blue-600 text-blue-50' },
  BUILD: { label: 'Build', className: 'bg-green-600 text-green-50' },
  VERIFY: { label: 'Verify', className: 'bg-orange-600 text-orange-50' },
  SHIP: { label: 'Ship', className: 'bg-purple-600 text-purple-50' },
};
```

### Text Truncation (Not Required)
**Reason**: Modal has full space to display complete title and description
**Overflow Handling**: Scrollable content area if description is very long

## Validation

### Client-Side Validation
**Not Required**: Read-only display, no user input to validate

### Data Integrity Checks
```typescript
// Type guard for null checking
const isValidTicket = (ticket: Ticket | null): ticket is Ticket => {
  return ticket !== null;
};

// Usage in component
{isValidTicket(ticket) && (
  // Render modal content
)}
```

## Error Handling

### Missing Data Scenarios

**Scenario 1: Ticket is null**
- **When**: Modal closed or no ticket selected
- **Handling**: Don't render modal content, Dialog remains closed

**Scenario 2: Empty description**
- **When**: Ticket has empty string for description (should not happen due to DB constraints)
- **Handling**: Display placeholder text: "No description provided"

**Scenario 3: Invalid date format**
- **When**: Date parsing fails (should not happen with Prisma Date types)
- **Handling**: Display raw ISO string or "Invalid date"

**Implementation**:
```typescript
const formattedDate = (date: Date | null): string => {
  if (!date) return 'Unknown date';
  try {
    return format(new Date(date), 'MMM d, yyyy h:mm a');
  } catch (error) {
    return 'Invalid date';
  }
};
```

## Performance Considerations

### Data Loading
- **No additional API calls**: Data already loaded in Board component
- **No lazy loading needed**: Modal renders on-demand when opened

### Memory Usage
- **Minimal overhead**: Single Ticket object reference (< 1KB)
- **No caching needed**: Ticket data already in parent state

### Rendering Performance
- **Fast initial render**: Simple component tree (Dialog + text elements)
- **No re-render issues**: Modal only renders when `open` prop is true
- **No memoization needed**: Component is lightweight

## Schema Changes Required

**None** - This feature uses the existing Ticket schema without modifications.

## Database Migrations Required

**None** - Read-only feature, no schema changes.

## API Changes Required

**None** - Using existing `GET /api/tickets` endpoint.

## Conclusion

This feature requires no data model changes. It purely presents existing Ticket data in a modal UI. All necessary types and entities already exist in the codebase. The implementation focuses on UI components and state management rather than data layer modifications.
