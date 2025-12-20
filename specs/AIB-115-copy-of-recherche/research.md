# Research: Ticket Search in Header

**Feature**: AIB-115-copy-of-recherche
**Date**: 2025-12-20

## Overview

This document captures research findings and decisions for implementing client-side ticket search in the header component.

## Research Tasks

### 1. Search Filtering Strategy

**Question**: Should we use useMemo or useDeferredValue for search filtering?

**Decision**: Use `useMemo`

**Rationale**:
- Search input value is controlled and predictable
- Filtering is synchronous and fast (no network calls)
- Results need to update immediately on keystroke
- Existing codebase pattern in MentionInput uses useMemo for filtering

**Alternatives Considered**:
- `useDeferredValue`: Better for expensive computations that should not block UI, but overkill for <500 tickets
- `useTransition`: For computations that might take longer, but client-side filtering is instant

**Implementation Pattern** (from existing MentionInput):
```typescript
const filteredTickets = useMemo(() => {
  if (!searchQuery.trim()) return [];

  const query = searchQuery.toLowerCase();
  return tickets.filter((ticket) =>
    ticket.ticketKey.toLowerCase().includes(query) ||
    ticket.title.toLowerCase().includes(query) ||
    ticket.description?.toLowerCase().includes(query)
  );
}, [tickets, searchQuery]);
```

---

### 2. Debounce Timing

**Question**: What is the best debounce timing for search inputs?

**Decision**: No debounce for client-side filtering (instant), 300ms if needed

**Rationale**:
- Client-side filtering with useMemo is instant (<1ms for 500 tickets)
- Debouncing adds unnecessary delay for instant operations
- Codebase pattern: MentionInput has no debounce for filtering
- If performance issues arise, 300ms debounce is the sweet spot for user perception

**Timing Reference from CLAUDE.md**:
- Jobs polling: 2s (active feedback)
- Comments polling: 10s (can wait)
- Notifications polling: 15s (user-aware events)

---

### 3. Keyboard Navigation Implementation

**Question**: How to implement keyboard navigation in dropdown lists?

**Decision**: Custom implementation following MentionInput pattern

**Rationale**:
- MentionInput already implements full keyboard navigation
- Battle-tested in production
- Handles edge cases (boundary checking, modal Escape handling)

**Key Patterns**:

1. **Arrow Key Navigation**:
```typescript
case 'ArrowDown':
  e.preventDefault();
  setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
  break;

case 'ArrowUp':
  e.preventDefault();
  setSelectedIndex((prev) => Math.max(prev - 1, 0));
  break;
```

2. **Enter Key Selection**:
```typescript
case 'Enter':
  e.preventDefault();
  if (results[selectedIndex]) {
    handleSelect(results[selectedIndex]);
  }
  break;
```

3. **Escape Key Close**:
```typescript
case 'Escape':
  e.preventDefault();
  e.stopPropagation(); // CRITICAL: Prevent parent modal from closing
  e.nativeEvent.stopImmediatePropagation();
  setIsOpen(false);
  break;
```

4. **Auto-scroll Selected Item**:
```typescript
useEffect(() => {
  if (isOpen && selectedIndex >= 0) {
    const element = document.querySelector('[data-selected="true"]');
    element?.scrollIntoView({ block: 'nearest' });
  }
}, [selectedIndex, isOpen]);
```

---

### 4. Accessibility (ARIA) Requirements

**Question**: What ARIA attributes are needed for accessible search?

**Decision**: ARIA combobox pattern with listbox results

**Implementation**:

```typescript
// Input with combobox role wrapper
<div role="combobox" aria-expanded={isOpen} aria-owns="ticket-listbox">
  <input
    id="ticket-search"
    type="text"
    aria-autocomplete="list"
    aria-controls="ticket-listbox"
    aria-label="Search tickets"
    placeholder="Search tickets..."
  />
</div>

// Results listbox
<div id="ticket-listbox" role="listbox" aria-label="Search results">
  {results.map((ticket, index) => (
    <button
      role="option"
      aria-selected={index === selectedIndex}
    >
      {ticket.ticketKey}: {ticket.title}
    </button>
  ))}
</div>

// Empty state
{results.length === 0 && query && (
  <div role="status" aria-live="polite">No results found</div>
)}
```

**ARIA Attributes Explained**:
- `role="combobox"`: Identifies search as combobox pattern
- `aria-expanded`: Indicates dropdown open/closed state
- `aria-owns`: Links input to dropdown listbox
- `aria-autocomplete="list"`: Indicates autocomplete behavior
- `role="listbox"`: Container for options
- `role="option"`: Individual selectable items
- `aria-selected`: Highlights current selection
- `aria-live="polite"`: Announces empty state changes

---

### 5. UI Component Selection

**Question**: Which shadcn/ui component is best: Popover, Command, or Combobox?

**Decision**: Custom component using Popover as base

**Rationale**:

| Component | Assessment |
|-----------|------------|
| **Popover** | Available in codebase, provides positioning but needs custom keyboard nav |
| **Command** | Not installed (requires cmdk library) |
| **Select** | Designed for static options, not dynamic search |

**Why Custom Component**:
1. MentionInput pattern already solves this problem
2. Full control over filtering and keyboard navigation
3. Can be built with existing shadcn/ui Popover
4. UserAutocomplete component provides reusable dropdown pattern

**Component Structure**:
```
components/search/
├── ticket-search.tsx        # Main search input + state management
└── ticket-search-result.tsx # Individual result item
```

---

### 6. Result Ranking Strategy

**Question**: How to order search results by relevance?

**Decision**: Prioritize by match location: key > title > description

**Implementation**:
```typescript
function rankSearchResult(ticket: Ticket, query: string): number {
  const q = query.toLowerCase();

  // Exact key match: highest priority
  if (ticket.ticketKey.toLowerCase() === q) return 3;

  // Key contains query
  if (ticket.ticketKey.toLowerCase().includes(q)) return 2;

  // Title contains query
  if (ticket.title.toLowerCase().includes(q)) return 1;

  // Description contains query (lowest priority)
  return 0;
}

const sortedResults = filteredTickets.sort((a, b) =>
  rankSearchResult(b, query) - rankSearchResult(a, query)
);
```

---

## Technology Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Filtering | `useMemo` | Synchronous, fast, immediate updates |
| Debounce | None (or 300ms if needed) | Client-side filtering is instant |
| Keyboard Nav | Custom implementation | Follows MentionInput pattern |
| Accessibility | ARIA combobox pattern | WCAG 2.1 AA compliant |
| UI Component | Custom with Popover | Best flexibility, already have pattern |
| Result Ranking | Key > Title > Description | Most intuitive for users |

## References

**Codebase Files**:
- `components/comments/mention-input.tsx` - Keyboard navigation pattern
- `components/comments/user-autocomplete.tsx` - Dropdown accessibility pattern
- `components/ui/popover.tsx` - Base positioning component
- `components/ui/input.tsx` - Input styling

**External**:
- WAI-ARIA Combobox Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
