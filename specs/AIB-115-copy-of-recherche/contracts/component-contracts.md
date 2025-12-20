# Component Contracts: Ticket Search

**Feature**: AIB-115-copy-of-recherche
**Date**: 2025-12-20

## Overview

This document defines the component interfaces and contracts for the ticket search feature. Since this is a client-side feature, contracts are TypeScript interfaces rather than API schemas.

## Component: TicketSearch

Main search component to be placed in the header.

### Props Interface

```typescript
interface TicketSearchProps {
  /**
   * All tickets available for searching
   * @required
   */
  tickets: TicketWithVersion[];

  /**
   * Callback fired when user selects a ticket
   * @required
   */
  onSelectTicket: (ticketId: number) => void;

  /**
   * Additional CSS class names
   * @optional
   */
  className?: string;

  /**
   * Placeholder text for the search input
   * @default "Search tickets..."
   */
  placeholder?: string;
}
```

### Behavior Contract

| User Action | Expected Behavior |
|-------------|-------------------|
| Type in input | Filter tickets, show dropdown if results |
| Press ArrowDown | Move selection down (boundary at last item) |
| Press ArrowUp | Move selection up (boundary at first item) |
| Press Enter | Select highlighted ticket, call onSelectTicket |
| Press Escape | Close dropdown, clear input |
| Click result | Select clicked ticket, call onSelectTicket |
| Click outside | Close dropdown (input text retained) |
| Empty query | Dropdown hidden |
| No matches | Show "No results found" message |

### Accessibility Contract

| Attribute | Value | Element |
|-----------|-------|---------|
| role | combobox | Container div |
| aria-expanded | boolean | Container div |
| aria-owns | "ticket-search-listbox" | Container div |
| aria-autocomplete | "list" | Input |
| aria-controls | "ticket-search-listbox" | Input |
| aria-label | "Search tickets" | Input |
| role | listbox | Results container |
| role | option | Each result item |
| aria-selected | boolean | Each result item |
| role | status | Empty state message |
| aria-live | "polite" | Empty state message |

## Component: TicketSearchResult

Individual result item in the dropdown.

### Props Interface

```typescript
interface TicketSearchResultProps {
  /**
   * The ticket to display
   * @required
   */
  ticket: TicketSearchResult;

  /**
   * Whether this result is currently selected
   * @required
   */
  isSelected: boolean;

  /**
   * Click handler
   * @required
   */
  onClick: () => void;

  /**
   * Test ID for E2E tests
   * @optional
   */
  "data-testid"?: string;
}
```

### Display Contract

```
┌─────────────────────────────────────────┐
│ [AIB-123]  Fix login button alignment   │
│ └─ key     └─ title (truncated)         │
└─────────────────────────────────────────┘
```

| Field | Display Rules |
|-------|---------------|
| ticketKey | Always visible, monospace font, muted color |
| title | Truncated with ellipsis if > ~40 chars |
| stage | Optional: subtle badge if needed |

## Utility Function: searchTickets

Pure function for filtering and ranking tickets.

### Function Signature

```typescript
/**
 * Filters and ranks tickets based on search query
 *
 * @param tickets - All tickets to search
 * @param query - Search query string
 * @param maxResults - Maximum results to return (default: 10)
 * @returns Filtered, ranked, and limited results
 */
function searchTickets(
  tickets: TicketWithVersion[],
  query: string,
  maxResults?: number
): TicketSearchResult[];
```

### Ranking Algorithm

```typescript
/**
 * Calculates relevance score for a ticket
 *
 * Scoring:
 * - Exact key match: 4 points
 * - Key contains query: 3 points
 * - Title starts with query: 2 points
 * - Title contains query: 1 point
 * - Description contains query: 0.5 points (tiebreaker)
 *
 * @param ticket - Ticket to score
 * @param query - Search query (already lowercased)
 * @returns Relevance score
 */
function calculateRelevance(
  ticket: TicketWithVersion,
  query: string
): number;
```

## Test Data Contracts

### Minimum Test Cases

```typescript
// Test fixtures for unit tests
const testTickets: TicketWithVersion[] = [
  { id: 1, ticketKey: 'AIB-1', title: 'First ticket', description: 'Description', ... },
  { id: 2, ticketKey: 'AIB-10', title: 'Tenth ticket', description: 'Another', ... },
  { id: 3, ticketKey: 'AIB-100', title: 'Hundredth ticket', description: 'More', ... },
  { id: 4, ticketKey: 'AIB-42', title: 'Answer to everything', description: 'Meaning of life', ... },
];

// Expected results for query "AIB-1"
// Order: AIB-1 (exact), AIB-10 (starts with), AIB-100 (starts with)
```

### E2E Test Selectors

| Element | data-testid |
|---------|-------------|
| Search input | ticket-search-input |
| Search container | ticket-search |
| Results dropdown | ticket-search-results |
| Individual result | ticket-search-result-{ticketKey} |
| Empty state | ticket-search-empty |
