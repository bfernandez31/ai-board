# Data Model: Command Autocomplete Fix

**Feature**: AIB-144 Fix Command Autocomplete Behavior and Dropdown Positioning

## Overview

This feature is UI-only with no database changes. The data model describes component state and types.

## Existing Types (No Changes)

```typescript
// components/comments/mention-input.tsx
type AutocompleteType = 'none' | 'mention' | 'ticket' | 'command';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  projectMembers: ProjectMember[];
  projectId: number;
  ticketId?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onAutocompleteOpenChange?: (isOpen: boolean) => void;
}
```

## New Type: AutocompletePosition

```typescript
// Enhanced position type with boundary information
interface AutocompletePosition {
  top: number;   // Vertical offset from textarea
  left: number;  // Horizontal offset from textarea
  flipAbove?: boolean; // True if dropdown should render above cursor
}
```

## Component State Model

| State | Type | Purpose | Initial |
|-------|------|---------|---------|
| autocompleteType | AutocompleteType | Current trigger type | 'none' |
| searchQuery | string | Query text after trigger | '' |
| selectedIndex | number | Keyboard nav index | 0 |
| triggerPosition | number \| null | Cursor position of trigger | null |
| autocompletePosition | AutocompletePosition | Dropdown coordinates | {top: 0, left: 0} |

## State Transitions

```
User types @[id:AI-BOARD] /
  → autocompleteType = 'command'
  → triggerPosition = position of /
  → searchQuery = ''

User types space
  → autocompleteType = 'none' (closes dropdown)

User selects command
  → Insert command + space
  → autocompleteType = 'none'
  → Cursor moves past insertion
```

## Positioning Calculation

```
Input: triggerPosition, textareaRef
  ↓
getCaretCoordinates(textarea, position)
  ↓
  { top: number, left: number } (relative to textarea)
  ↓
calculateBoundedPosition(coords, viewport)
  ↓
  { top, left, flipAbove } (boundary-aware)
  ↓
setAutocompletePosition(position)
```

## Entity Relationships

```
MentionInput (container)
  │
  ├── Textarea (input)
  │
  └── Dropdown (conditional)
      ├── UserAutocomplete (type='mention')
      ├── TicketAutocomplete (type='ticket')
      └── CommandAutocomplete (type='command')
```

## Validation Rules

1. Command autocomplete triggers ONLY after @[...AI-BOARD...] pattern
2. Dropdown closes when query contains space
3. Dropdown position must remain within viewport bounds
4. Position recalculates when trigger position changes
