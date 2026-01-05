# Data Model: Fix Command Autocomplete Behavior and Dropdown Positioning

**Branch**: `AIB-143-copy-of-fix` | **Date**: 2026-01-05

## Overview

This feature is a **client-side UI bug fix** with no database, API, or persistent data changes. All modifications are scoped to React component state within `MentionInput`.

## State Entities

### Existing State (No Changes)

| State Variable | Type | Purpose |
|----------------|------|---------|
| `autocompleteType` | `'none' \| 'mention' \| 'ticket' \| 'command'` | Current autocomplete mode |
| `searchQuery` | `string` | Text after trigger character |
| `selectedIndex` | `number` | Keyboard navigation index |
| `triggerPosition` | `number \| null` | Cursor position of trigger character |
| `autocompletePosition` | `{ top: number; left: number }` | Dropdown positioning |

### New State Required

| State Variable | Type | Purpose |
|----------------|------|---------|
| `completedCommandPosition` | `number \| null` | Position of last selected command trigger |

**Rationale**: Tracks that a command was already selected at a specific trigger position, preventing re-triggering when the user continues typing.

## Type Definitions

### Existing Types (Referenced)

```typescript
// From @/app/lib/data/ai-board-commands
interface AIBoardCommand {
  name: string;
  description: string;
}

// From @/app/lib/types/mention
interface ProjectMember {
  id: string;
  name: string | null;
  email: string;
}

// From @/app/lib/types/search
interface SearchResult {
  id: number;
  ticketKey: string;
  title: string;
  stage: string;
}
```

### New Types (None Required)

No new TypeScript types are needed. The viewport position calculation uses primitive types (`number`).

## Validation Rules

N/A - No user input validation changes. This is a UI behavior fix.

## State Transitions

### Command Autocomplete Lifecycle

```
IDLE → TRIGGERED → FILTERING → SELECTED → COMPLETED
  │                    │           │          │
  │                    │           │          └── completedCommandPosition set
  │                    │           └── User types space: IDLE
  │                    └── No matches: IDLE
  └── User types @ai-board /: TRIGGERED
```

### Key Transition: Selection → Completed

When a command is selected:
1. `autocompleteType` → `'none'`
2. `searchQuery` → `''`
3. `triggerPosition` → `null`
4. `completedCommandPosition` → `triggerPosition` (NEW)

When user types after `@ai-board /`:
- If `completedCommandPosition === triggerPosition`: Do NOT reopen autocomplete
- Otherwise: Normal trigger behavior

## Database Changes

**None** - This is a pure client-side fix.

## API Changes

**None** - No server-side changes required.
