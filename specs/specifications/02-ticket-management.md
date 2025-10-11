# Ticket Management

## Overview

This domain covers ticket interaction features including movement between stages, viewing details, and editing content. These capabilities enable users to manage tickets throughout their workflow lifecycle.

**Current Capabilities**:
- Drag-and-drop movement between stages
- Ticket detail modal viewer
- Inline title and description editing
- Sequential workflow enforcement

---

## Drag-and-Drop Movement

**Purpose**: Users need to move tickets through workflow stages quickly. Drag-and-drop provides an intuitive, visual way to update ticket status without opening forms or dialogs.

### What It Does

The system enables dragging tickets between columns with visual feedback:

**Drag Operations**:
- **Pick Up**: Click and hold any ticket card
- **Visual Feedback**:
  - Ghost/preview of dragged ticket
  - Valid drop zones highlighted
  - Invalid zones indicated
- **Drop**: Release ticket in target column
- **Cancel**: Press ESC or release outside valid zones

**Movement Rules**:
- **Sequential Only**: Tickets can only move to next immediate stage
  - INBOX → SPECIFY
  - SPECIFY → PLAN
  - PLAN → BUILD
  - BUILD → VERIFY
  - VERIFY → SHIP
- **No Skipping**: Cannot skip stages (e.g., INBOX → PLAN blocked)
- **No Backwards**: Cannot move to earlier stages (e.g., BUILD → PLAN blocked)

**Visual Indicators**:
- Smooth animations for drag, drop, and return
- Next valid stage highlighted during drag
- Invalid transitions show rejection animation
- Touch device support (mobile/tablet)

**Performance**:
- Optimistic UI updates (instant visual feedback)
- Database update in background
- Rollback if database update fails
- <100ms latency target

### Requirements

**Drag Interaction**:
- Click and drag any ticket card
- Ghost/preview during drag
- Valid drop zones highlighted (only next sequential stage)
- Smooth animations for all movements
- Touch device support

**Stage Transitions**:
- Sequential progression only (one stage at a time)
- No skipping stages
- No backwards movement
- Visual rejection for invalid transitions

**Data Updates**:
- Optimistic UI update (immediate visual change)
- Database update after drop
- Rollback to original position if update fails
- Error message displayed on failure

**Concurrency**:
- First-write-wins for simultaneous updates
- Second user sees error and ticket reverts
- Version-based conflict detection

**Performance**:
- <100ms latency from drop to visual update
- Maintains performance with 100+ tickets per column

**Authentication**:
- Any authenticated user can move any ticket
- Unauthenticated users cannot drag tickets

**Offline**:
- Drag-and-drop disabled when network unavailable
- Visual indicator when disabled

### Data Model

**Stage Sequence**:
```
INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP
```

**Ticket Update**:
- `stage`: Updated to target stage
- `version`: Incremented for concurrency control
- `updatedAt`: Set to current timestamp

---

## Ticket Detail Viewer

**Purpose**: Users need to see complete ticket information including full title, description, dates, and stage. The detail modal provides a focused view without navigating away from the board.

### What It Does

The system displays full ticket details in a modal dialog:

**Opening Detail View**:
- Click any ticket card
- Modal opens with full details

**Information Displayed**:
- **Title**: Full title (not truncated)
- **Description**: Complete description text
- **Stage**: Current stage as visual indicator
- **Created**: Creation date
- **Updated**: Last modification date
- **Typography**: Clear hierarchy and readability
- **Dark Theme**: Consistent with application styling

**Modal Controls**:
- **Close Button**: X button in corner
- **ESC Key**: Closes modal
- **Click Outside**: Closes modal
- **Responsive**:
  - Mobile: Full-screen modal
  - Desktop/Tablet: Centered with appropriate sizing

### Requirements

**Modal Display**:
- Opens when clicking any ticket card
- Displays title prominently
- Shows full description text
- Shows current stage indicator
- Shows creation and update dates
- Clear typography and visual hierarchy
- Dark theme styling

**Modal Dismissal**:
- Close button
- ESC key
- Click outside modal content

**Responsive**:
- Full-screen on mobile devices
- Centered with responsive sizing on desktop/tablet

### Data Model

**Displayed Fields**:
- `title`: Full text without truncation
- `description`: Complete description
- `stage`: Current workflow stage
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp

---

## Inline Editing

**Purpose**: Users need to update ticket information quickly without navigating to separate edit screens. Inline editing provides contextual editing directly in the detail modal.

### What It Does

The system enables editing title and description directly in the detail modal:

**Edit Activation**:
- **Title**: Click on title to edit
- **Description**: Click on description to edit
- **Visual Indicator**: Pencil icon appears on hover

**Title Editing**:
- Click title → becomes input field with focus
- Type changes
- Save: Press Enter or click outside
- Cancel: Press ESC (restores original)
- Max 100 characters enforced

**Description Editing**:
- Click description → becomes textarea with focus
- Type changes
- Character counter displayed
- 90% warning at 900 characters
- Save: Click save button
- Cancel: Click cancel button or press ESC
- Min 1, max 1000 characters enforced

**Validation**:
- Real-time validation as user types
- Save button disabled when invalid
- Cannot save empty or whitespace-only content
- Clear inline error messages

**Save Process**:
- Optimistic UI update (immediate display)
- Loading state shown
- Database update in background
- Rollback if save fails
- Success toast notification
- Board state refreshes to reflect changes

**Concurrent Editing**:
- Version-based conflict detection
- Descriptive error if conflict detected
- Prompt to refresh ticket data
- Lost update protection

### Requirements

**Edit Activation**:
- Click title or description to edit
- Pencil icon on hover indicates editability
- Auto-focus input field when entering edit mode

**Title Editing**:
- Enter edit mode on click
- Max 100 characters
- No empty or whitespace-only
- Save on Enter or click outside
- Cancel on ESC

**Description Editing**:
- Enter edit mode on click
- Character counter displayed
- Min 1, max 1000 characters
- 90% warning at 900 characters
- No empty or whitespace-only
- Save and cancel buttons visible during edit

**Validation**:
- Real-time validation
- Save disabled when invalid
- Inline error messages

**Save & Concurrency**:
- Optimistic UI update
- Loading state during save
- Rollback on failure
- Version-based conflict detection
- Success/error notifications
- Board refresh after save

### Data Model

**Editable Fields**:
- `title`: 1-100 characters
- `description`: 1-1000 characters
- `version`: Incremented on each update (concurrency control)
- `updatedAt`: Set to current timestamp on save

**Validation Rules**:
- Allowed characters: letters (a-z, A-Z), numbers (0-9), spaces, and special characters (`. , ? ! - : ; ' " ( ) [ ] { } / \ @ # $ % & * + = _ ~ \` |`)
- Rejects characters outside allowed set (emojis, control characters, other Unicode)
- No empty or whitespace-only values
- Character limits enforced
- Same validation rules apply to both title and description fields

---

## Current State Summary

### Available Features

**Drag-and-Drop**:
- ✅ Visual drag with ghost/preview
- ✅ Sequential stage progression enforcement
- ✅ Smooth animations
- ✅ Touch device support
- ✅ Optimistic updates with rollback
- ✅ <100ms latency
- ✅ Concurrent update protection

**Detail Viewer**:
- ✅ Full ticket information display
- ✅ Clear typography and hierarchy
- ✅ Multiple modal dismissal methods
- ✅ Responsive (full-screen mobile, centered desktop)
- ✅ Dark theme styling

**Inline Editing**:
- ✅ Click-to-edit title and description
- ✅ Real-time validation
- ✅ Character counters and warnings
- ✅ Optimistic updates with rollback
- ✅ Concurrent edit protection
- ✅ Success/error notifications

### User Workflows

**Moving a Ticket**:
1. User clicks and holds ticket card
2. Ticket shows ghost/preview while dragging
3. Valid next stage highlights
4. User releases over next stage
5. Ticket moves immediately (optimistic)
6. Database confirms update

**Viewing Ticket Details**:
1. User clicks ticket card
2. Modal opens with full details
3. User reviews title, description, dates, stage
4. User closes modal (button/ESC/click-outside)

**Editing a Ticket**:
1. User clicks ticket to open detail modal
2. User clicks title or description to edit
3. Field becomes editable with focus
4. User makes changes
5. User saves (Enter/click-outside for title, save button for description)
6. Changes save immediately with visual confirmation
7. Board updates to reflect changes

### Business Rules

**Movement**:
- Sequential stage progression only (one stage forward)
- No skipping stages
- No backwards movement
- Any authenticated user can move any ticket
- First-write-wins for concurrent moves
- Offline: drag-and-drop disabled

**Editing**:
- Title: 1-100 characters
- Description: 1-1000 characters
- Both required (no empty values)
- Allowed characters: letters (a-z, A-Z), numbers (0-9), spaces, and special characters (`. , ? ! - : ; ' " ( ) [ ] { } / \ @ # $ % & * + = _ ~ \` |`)
- Rejects emojis, control characters, and other Unicode characters outside allowed set
- Title and description use identical character validation rules
- Version-based conflict detection prevents lost updates
- Optimistic updates with rollback on failure

### Technical Details

**Drag-and-Drop**:
- @dnd-kit/core and @dnd-kit/sortable libraries
- Touch event support
- Optimistic UI with rollback
- Version field for concurrency

**Modal**:
- shadcn/ui Dialog component
- Radix UI primitives
- Responsive breakpoints

**Validation**:
- Zod schemas
- Real-time validation
- Client and server validation
