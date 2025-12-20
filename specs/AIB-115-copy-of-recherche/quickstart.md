# Quickstart: Ticket Search in Header

**Feature**: AIB-115-copy-of-recherche
**Date**: 2025-12-20

## Quick Implementation Guide

### Prerequisites

- Node.js 22.20.0
- Existing ai-board development environment
- Familiarity with React hooks, TanStack Query, shadcn/ui

### Files to Create

```
components/search/
├── ticket-search.tsx          # Main search component
└── ticket-search-result.tsx   # Result item component

lib/utils/
└── ticket-search.ts           # Search utility functions

tests/unit/
└── ticket-search.test.ts      # Vitest unit tests

tests/e2e/
└── ticket-search.spec.ts      # Playwright E2E tests
```

### Files to Modify

```
components/layout/header.tsx   # Add TicketSearch component
```

### Step-by-Step Implementation

#### Step 1: Create Search Utility (TDD - Write Tests First)

```typescript
// tests/unit/ticket-search.test.ts
import { describe, it, expect } from 'vitest';
import { searchTickets, calculateRelevance } from '@/lib/utils/ticket-search';

describe('searchTickets', () => {
  it('returns empty array for empty query', () => {
    const tickets = [{ ticketKey: 'AIB-1', title: 'Test' }];
    expect(searchTickets(tickets, '')).toEqual([]);
  });

  it('matches by ticket key', () => {
    const tickets = [{ id: 1, ticketKey: 'AIB-42', title: 'Test' }];
    const results = searchTickets(tickets, 'AIB-42');
    expect(results).toHaveLength(1);
    expect(results[0].ticketKey).toBe('AIB-42');
  });

  // ... more tests
});
```

#### Step 2: Implement Search Utility

```typescript
// lib/utils/ticket-search.ts
import { TicketWithVersion } from '@/lib/types';

export interface TicketSearchResult {
  id: number;
  ticketKey: string;
  title: string;
  stage: string;
  relevanceScore: number;
}

export function searchTickets(
  tickets: TicketWithVersion[],
  query: string,
  maxResults = 10
): TicketSearchResult[] {
  if (!query.trim()) return [];

  const q = query.toLowerCase();

  return tickets
    .map((ticket) => ({
      id: ticket.id,
      ticketKey: ticket.ticketKey,
      title: ticket.title,
      stage: ticket.stage,
      relevanceScore: calculateRelevance(ticket, q),
    }))
    .filter((result) => result.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}

export function calculateRelevance(
  ticket: TicketWithVersion,
  query: string
): number {
  const key = ticket.ticketKey.toLowerCase();
  const title = ticket.title.toLowerCase();
  const desc = (ticket.description || '').toLowerCase();

  if (key === query) return 4;
  if (key.includes(query)) return 3;
  if (title.startsWith(query)) return 2;
  if (title.includes(query)) return 1;
  if (desc.includes(query)) return 0.5;

  return 0;
}
```

#### Step 3: Create TicketSearch Component

```typescript
// components/search/ticket-search.tsx
'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TicketSearchResult } from './ticket-search-result';
import { searchTickets } from '@/lib/utils/ticket-search';
import type { TicketWithVersion } from '@/lib/types';

interface TicketSearchProps {
  tickets: TicketWithVersion[];
  onSelectTicket: (ticketId: number) => void;
  className?: string;
}

export function TicketSearch({
  tickets,
  onSelectTicket,
  className
}: TicketSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => searchTickets(tickets, query),
    [tickets, query]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelectTicket(results[selectedIndex].id);
          setQuery('');
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        setQuery('');
        setIsOpen(false);
        break;
    }
  }, [results, selectedIndex, onSelectTicket]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Open dropdown when typing
  useEffect(() => {
    setIsOpen(query.trim().length > 0);
  }, [query]);

  return (
    <div
      ref={containerRef}
      className={className}
      role="combobox"
      aria-expanded={isOpen}
      aria-owns="ticket-search-listbox"
      data-testid="ticket-search"
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search tickets..."
          aria-autocomplete="list"
          aria-controls="ticket-search-listbox"
          aria-label="Search tickets"
          data-testid="ticket-search-input"
          className="pl-9 w-64"
        />
      </div>

      {isOpen && (
        <div
          id="ticket-search-listbox"
          role="listbox"
          data-testid="ticket-search-results"
          className="absolute mt-1 w-64 bg-popover border rounded-md shadow-lg max-h-80 overflow-y-auto z-50"
        >
          {results.length === 0 ? (
            <div
              role="status"
              aria-live="polite"
              data-testid="ticket-search-empty"
              className="p-3 text-sm text-muted-foreground text-center"
            >
              No results found
            </div>
          ) : (
            results.map((result, index) => (
              <TicketSearchResult
                key={result.id}
                ticket={result}
                isSelected={index === selectedIndex}
                onClick={() => {
                  onSelectTicket(result.id);
                  setQuery('');
                  setIsOpen(false);
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

#### Step 4: Add to Header

```typescript
// Modify components/layout/header.tsx
import { TicketSearch } from '@/components/search/ticket-search';

// Inside Header component, add between project info and user menu:
{projectInfo && (
  <TicketSearch
    tickets={allTickets}
    onSelectTicket={handleTicketSelect}
    className="hidden md:flex"
  />
)}
```

### Running Tests

```bash
# Run unit tests
bun run test:unit

# Run E2E tests
bun run test:e2e tests/e2e/ticket-search.spec.ts

# Run all tests
bun test
```

### Key Implementation Notes

1. **Client-side only**: No API endpoints needed, uses existing ticket cache
2. **TDD**: Write tests first (unit for utils, E2E for UI)
3. **shadcn/ui**: Use Input component, match existing styling
4. **Accessibility**: Follow ARIA combobox pattern
5. **Performance**: useMemo for filtering, no debounce needed

### Common Pitfalls

- Forgetting `e.stopPropagation()` on Escape (will close parent modals)
- Not resetting selectedIndex when results change
- Missing click-outside handler (use useEffect with document listener)
