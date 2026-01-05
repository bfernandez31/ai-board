# Quickstart: Comment with Ticket and Command Autocomplete

**Branch**: `AIB-141-comment-with-ticket` | **Date**: 2026-01-05

## Implementation Overview

Extend `MentionInput` component to support three autocomplete triggers:
- `@` - User mentions (existing)
- `#` - Ticket references (new)
- `/` - AI-BOARD commands (new, after @ai-board)

## Implementation Order

### 1. Static Command Data

Create `app/lib/data/ai-board-commands.ts`:

```typescript
export interface AIBoardCommand {
  name: string;
  description: string;
}

export const AI_BOARD_COMMANDS: AIBoardCommand[] = [
  {
    name: '/compare',
    description: 'Compare ticket implementations for best code quality',
  },
];
```

### 2. Types Extension

Add to `app/lib/types/mention.ts`:

```typescript
export interface TicketSearchResult {
  id: number;
  ticketKey: string;
  title: string;
  stage: string;
}

export { AIBoardCommand } from '@/app/lib/data/ai-board-commands';
```

### 3. Ticket Search Hook

Create `app/lib/hooks/queries/use-ticket-search.ts`:

```typescript
export function useTicketSearch(projectId: number, query: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.projects.ticketSearch(projectId, query),
    queryFn: () => searchTickets(projectId, query),
    enabled: enabled && !!projectId && query.length >= 2,
    staleTime: 30_000,
  });
}
```

### 4. Ticket Autocomplete Component

Create `components/comments/ticket-autocomplete.tsx`:

- Follow `UserAutocomplete` pattern
- Display: `{ticketKey} - {title}` with stage badge
- Empty state: "No tickets found"
- Props: `tickets`, `onSelect`, `selectedIndex`

### 5. Command Autocomplete Component

Create `components/comments/command-autocomplete.tsx`:

- Follow `UserAutocomplete` pattern
- Display: `{name}` with description below
- Empty state: "No commands available"
- Props: `commands`, `onSelect`, `selectedIndex`

### 6. MentionInput Extension

Modify `components/comments/mention-input.tsx`:

1. Add state for active autocomplete type:
   ```typescript
   type AutocompleteType = 'none' | 'mention' | 'ticket' | 'command';
   const [autocompleteType, setAutocompleteType] = useState<AutocompleteType>('none');
   ```

2. Extend `handleInputChange` for `#` and `/` detection

3. Render appropriate dropdown based on `autocompleteType`

4. Update `handleSelectTicket` and `handleSelectCommand` handlers

## Key Patterns

### Trigger Detection

```typescript
// Ticket trigger: # at word boundary
const hashIndex = textBeforeCursor.lastIndexOf('#');
const charBeforeHash = textBeforeCursor[hashIndex - 1];
const isHashAtWordBoundary = !charBeforeHash || /\s/.test(charBeforeHash);

// Command trigger: / after @ai-board mention
const slashIndex = textBeforeCursor.lastIndexOf('/');
const textBeforeSlash = textBeforeCursor.substring(0, slashIndex);
const aiBoardPattern = /@\[[^\]]+:AI-BOARD\]\s*$/;
const isAfterAIBoard = aiBoardPattern.test(textBeforeSlash);
```

### Selection Handlers

```typescript
// Insert ticket reference
const handleSelectTicket = (ticket: TicketSearchResult) => {
  const newValue =
    value.substring(0, hashSymbolPosition) +
    `#${ticket.ticketKey}` +
    ' ' +
    value.substring(cursorPos);
  onChange(newValue);
};

// Insert command
const handleSelectCommand = (command: AIBoardCommand) => {
  const newValue =
    value.substring(0, slashSymbolPosition) +
    command.name +
    ' ' +
    value.substring(cursorPos);
  onChange(newValue);
};
```

## Testing Strategy

### Component Tests (RTL)

```typescript
// Ticket autocomplete
it('shows ticket dropdown on # trigger', async () => {
  renderWithProviders(<MentionInput {...props} />);
  await userEvent.type(screen.getByRole('textbox'), '#AIB');
  expect(screen.getByRole('listbox')).toBeInTheDocument();
});

// Command autocomplete
it('shows command dropdown on / after @ai-board', async () => {
  renderWithProviders(<MentionInput {...props} value="@[id:AI-BOARD] " />);
  await userEvent.type(screen.getByRole('textbox'), '/');
  expect(screen.getByText('/compare')).toBeInTheDocument();
});
```

### Integration Tests

```typescript
it('searches tickets with query', async () => {
  const response = await fetch('/api/projects/1/tickets/search?q=AIB');
  expect(response.ok).toBe(true);
  const data = await response.json();
  expect(data.results).toBeDefined();
});
```

## Verification

1. Type `#` in comment → Ticket dropdown appears
2. Type `#AIB` → Dropdown filters to matching tickets
3. Select ticket → `#AIB-120` inserted
4. Type `@ai-board /` → Command dropdown appears
5. Select command → `/compare` inserted
6. Escape closes any dropdown
7. Arrow keys navigate dropdowns
