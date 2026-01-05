# Research: Comment with Ticket and Command Autocomplete

**Branch**: `AIB-141-comment-with-ticket` | **Date**: 2026-01-05

## Research Summary

All unknowns resolved. Implementation follows existing patterns with minimal new code.

---

## Decision 1: Ticket Autocomplete Data Source

**Decision**: Reuse existing `/api/projects/[projectId]/tickets/search` endpoint with a new lightweight query hook.

**Rationale**:
- Existing search endpoint already returns `{ id, ticketKey, title, stage }` with relevance-based sorting
- Endpoint respects project access (owner OR member)
- 2-character minimum query prevents excessive requests
- Limit parameter caps results at 50

**Alternatives Rejected**:
- **New endpoint**: Unnecessary—search endpoint covers autocomplete needs
- **Client-side filtering from full ticket list**: Would fetch excessive data for large projects

**Implementation**:
- Create `useTicketSearch(projectId, query)` hook with debounced input
- Hook returns tickets filtered by query, sorted by relevance
- Empty query returns empty array (no search with <2 chars)

---

## Decision 2: Command List Source

**Decision**: Static TypeScript constant in `app/lib/data/ai-board-commands.ts`.

**Rationale**:
- Only one command currently (`/compare`)
- Commands are AI-BOARD specific, not user-configurable
- No API call needed—filter client-side
- Future commands added via code changes (intentional—commands are features)

**Alternatives Rejected**:
- **Dynamic from `.claude/commands/`**: Exposes internal commands not meant for user invocation
- **Database table**: Over-engineering for <10 static commands

**Implementation**:
```typescript
export interface AIBoardCommand {
  name: string;        // e.g., "/compare"
  description: string; // Short description for dropdown
}

export const AI_BOARD_COMMANDS: AIBoardCommand[] = [
  {
    name: '/compare',
    description: 'Compare ticket implementations for best code quality',
  },
];
```

---

## Decision 3: Trigger Detection Strategy

**Decision**: Extend existing `MentionInput` component to detect `#` and `/` triggers alongside `@`.

**Rationale**:
- Single component manages all autocomplete behaviors
- Shared keyboard navigation, position calculation, outside-click handling
- Consistent UX across all trigger types

**Pattern Analysis** (from `mention-input.tsx`):
1. On input change, scan text before cursor for trigger char
2. Validate trigger is at word boundary
3. Check cursor not inside existing markup
4. Extract search query after trigger
5. Open appropriate dropdown at caret position

**Implementation**:
- Add `activeAutocomplete` state: `'none' | 'mention' | 'ticket' | 'command'`
- Add trigger detection for `#` (word boundary) and `/` (after `@ai-board` mention)
- Render different dropdown based on `activeAutocomplete`

---

## Decision 4: Command Trigger Context

**Decision**: `/` only triggers command autocomplete immediately after `@ai-board` mention.

**Rationale**:
- User spec: "After a @mention to AI board assistance, if we type /..."
- Prevents false triggers (e.g., typing paths like `/path/to/file`)
- Commands only make sense in AI-BOARD context

**Detection Logic**:
```typescript
// Find @[ai-board-id:AI-BOARD] mention before cursor
const textBeforeCursor = content.substring(0, cursorPos);
const aiBoardMentionRegex = /@\[[^\]]+:AI-BOARD\]\s*$/;
const isAfterAIBoard = aiBoardMentionRegex.test(textBeforeCursor.substring(0, lastSlashIndex));
```

---

## Decision 5: Dropdown Component Strategy

**Decision**: Create two new components following `UserAutocomplete` pattern.

**Components**:
1. `TicketAutocomplete` - Shows `{ticketKey} - {title}` with stage badge
2. `CommandAutocomplete` - Shows `{name}` with description

**Shared Patterns** (from `UserAutocomplete`):
- `data-testid` for test targeting
- `role="listbox"` / `role="option"` for accessibility
- `data-selected` for keyboard navigation styling
- Click outside closes dropdown
- Empty state message

---

## Decision 6: Ticket Reference Format

**Decision**: Insert `#{ticketKey}` (e.g., `#AIB-120`) as plain text.

**Rationale**:
- User spec: "on select, have only the ticket key like this: #AIB-120"
- No special markup needed—hash prefix is the convention
- Display component can optionally linkify `#KEY-123` patterns

**Alternatives Rejected**:
- **Mention-style markup `#[ticketId:ticketKey]`**: Over-engineering; tickets aren't users
- **Full URL**: Verbose; breaks comment readability

---

## Decision 7: Ticket List Limit and Sorting

**Decision**: Show up to 10 tickets, sorted by relevance then recency.

**Rationale**:
- 10 items fits dropdown without scrolling
- Relevance sorting (key match > title match > description) from existing search
- Recency as secondary sort (updatedAt DESC) surfaces active tickets

**Edge Cases**:
- Empty project: "No tickets found" message
- 100+ tickets: Search filters early; initial dropdown shows recent 10

---

## Technology Choices

### TanStack Query Pattern

**Hook**: `useTicketSearch(projectId: number, query: string)`

```typescript
return useQuery({
  queryKey: queryKeys.projects.ticketSearch(projectId, query),
  queryFn: () => searchTickets(projectId, query),
  enabled: !!projectId && query.length >= 1, // Search from 1 char for tickets
  staleTime: 30 * 1000, // 30 seconds (tickets change more than members)
});
```

**Note**: Override 2-char API limit by fetching all recent tickets when query is 1 char.

### Debouncing

**Approach**: Debounce search query input by 150ms to reduce API calls while typing.

**Implementation**: Use `useDeferredValue` or custom debounce hook with TanStack Query.

---

## Files to Modify/Create

### Modify
- `components/comments/mention-input.tsx` - Add `#` and `/` trigger detection
- `app/lib/types/mention.ts` - Add `AIBoardCommand` and `TicketSearchResult` types
- `app/lib/query-keys.ts` - Already has `ticketSearch` key ✓

### Create
- `components/comments/ticket-autocomplete.tsx` - Ticket dropdown component
- `components/comments/command-autocomplete.tsx` - Command dropdown component
- `app/lib/data/ai-board-commands.ts` - Static command definitions
- `app/lib/hooks/queries/use-ticket-search.ts` - TanStack Query hook

### Tests
- `tests/unit/components/ticket-autocomplete.test.tsx` - RTL component tests
- `tests/unit/components/command-autocomplete.test.tsx` - RTL component tests
- `tests/integration/comments/autocomplete.test.ts` - API integration tests
