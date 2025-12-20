# Quickstart: Ticket Search Implementation

**Feature**: AIB-114 - Recherche de ticket
**Date**: 2025-12-19

## Prerequisites

- Node.js 22.20.0+
- Access to AI-Board codebase
- Running PostgreSQL database

## Quick Implementation Guide

### Step 1: Create Search Types

**File**: `/app/lib/types/search.ts`

```typescript
import { Stage } from '@prisma/client';

export interface SearchResult {
  id: number;
  ticketKey: string;
  title: string;
  stage: Stage;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
}
```

### Step 2: Add Query Key

**File**: `/app/lib/query-keys.ts` (modify)

```typescript
// Add to projects object:
ticketSearch: (projectId: number, query: string) =>
  ['projects', projectId, 'tickets', 'search', query] as const,
```

### Step 3: Create Search API Endpoint

**File**: `/app/api/projects/[projectId]/tickets/search/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    // Verify access
    const hasAccess = await verifyProjectAccess(projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get query param
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() ?? '';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 50);

    if (query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Search tickets
    const tickets = await prisma.ticket.findMany({
      where: {
        projectId,
        OR: [
          { ticketKey: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        ticketKey: true,
        title: true,
        stage: true,
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    // Sort by relevance (key match > title match > description match)
    const queryLower = query.toLowerCase();
    tickets.sort((a, b) => {
      const scoreA = a.ticketKey.toLowerCase() === queryLower ? 4 :
                     a.ticketKey.toLowerCase().includes(queryLower) ? 3 :
                     a.title.toLowerCase().includes(queryLower) ? 2 : 1;
      const scoreB = b.ticketKey.toLowerCase() === queryLower ? 4 :
                     b.ticketKey.toLowerCase().includes(queryLower) ? 3 :
                     b.title.toLowerCase().includes(queryLower) ? 2 : 1;
      return scoreB - scoreA;
    });

    return NextResponse.json({
      results: tickets,
      totalCount: tickets.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Step 4: Create Search Hook

**File**: `/app/lib/hooks/queries/useTicketSearch.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { SearchResponse } from '@/app/lib/types/search';

async function searchTickets(projectId: number, query: string): Promise<SearchResponse> {
  const response = await fetch(
    `/api/projects/${projectId}/tickets/search?q=${encodeURIComponent(query)}`
  );
  if (!response.ok) {
    throw new Error('Search failed');
  }
  return response.json();
}

export function useTicketSearch(projectId: number, query: string) {
  return useQuery({
    queryKey: queryKeys.projects.ticketSearch(projectId, query),
    queryFn: () => searchTickets(projectId, query),
    enabled: query.length >= 2,
    staleTime: 30000, // 30 seconds
  });
}
```

### Step 5: Create Search Components

**File**: `/components/search/search-results.tsx`

```typescript
'use client';

import { cn } from '@/lib/utils';
import type { SearchResult } from '@/app/lib/types/search';

interface SearchResultsProps {
  results: SearchResult[];
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
  isLoading?: boolean;
  error?: Error | null;
}

export function SearchResults({
  results,
  selectedIndex,
  onSelect,
  isLoading,
  error,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Searching...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-sm text-destructive">
        Search unavailable
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No tickets found
      </div>
    );
  }

  return (
    <div role="listbox" aria-label="Search results">
      {results.map((result, index) => (
        <button
          key={result.id}
          type="button"
          role="option"
          aria-selected={index === selectedIndex}
          data-selected={index === selectedIndex}
          onClick={() => onSelect(result)}
          className={cn(
            'w-full text-left px-3 py-2 transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'focus:outline-none focus:bg-accent focus:text-accent-foreground',
            index === selectedIndex && 'bg-primary text-primary-foreground'
          )}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">{result.ticketKey}</span>
            <span className="truncate">{result.title}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
```

**File**: `/components/search/ticket-search.tsx`

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { SearchResults } from './search-results';
import { useTicketSearch } from '@/app/lib/hooks/queries/useTicketSearch';
import type { SearchResult } from '@/app/lib/types/search';

interface TicketSearchProps {
  projectId: number;
}

export function TicketSearch({ projectId }: TicketSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch search results
  const { data, isLoading, error } = useTicketSearch(projectId, debouncedTerm);
  const results = data?.results ?? [];

  // Open dropdown when we have a query
  useEffect(() => {
    setIsOpen(debouncedTerm.length >= 2);
    setSelectedIndex(0);
  }, [debouncedTerm]);

  // Handle result selection
  const handleSelect = useCallback((result: SearchResult) => {
    const params = new URLSearchParams(searchParams);
    params.set('ticket', result.id.toString());
    router.push(`?${params.toString()}`);
    setSearchTerm('');
    setIsOpen(false);
  }, [router, searchParams]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape' && searchTerm) {
        e.preventDefault();
        setSearchTerm('');
      }
      return;
    }

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
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  }, [isOpen, results, selectedIndex, searchTerm, handleSelect]);

  // Auto-scroll selected item
  useEffect(() => {
    const selected = document.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-64 pl-9"
            aria-label="Search tickets"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-80 p-0 max-h-[300px] overflow-y-auto"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SearchResults
          results={results}
          selectedIndex={selectedIndex}
          onSelect={handleSelect}
          isLoading={isLoading}
          error={error}
        />
      </PopoverContent>
    </Popover>
  );
}
```

### Step 6: Integrate into Header

**File**: `/components/layout/header.tsx` (modify)

Add import:
```typescript
import { TicketSearch } from '@/components/search/ticket-search';
```

Add component (in center section, after project info):
```typescript
{/* Center: Search (when project selected) */}
{projectInfo && (
  <div className="flex-1 flex justify-center">
    <TicketSearch projectId={projectInfo.id} />
  </div>
)}
```

---

## Testing Checklist

### Unit Tests (Vitest)
- [ ] Search relevance sorting function
- [ ] Query validation (min 2 chars)
- [ ] Debounce logic

### Integration Tests (Playwright)
- [ ] Search input appears on project board
- [ ] Typing triggers dropdown with results
- [ ] Clicking result opens ticket modal
- [ ] Keyboard navigation works (Arrow keys, Enter, Escape)
- [ ] No results shows empty message
- [ ] Search hidden on non-project pages

---

## Commands

```bash
# Run development server
bun run dev

# Run unit tests
bun run test:unit

# Run E2E tests
bun run test:e2e

# Type check
bun run type-check
```

---

## Common Issues

### Search not appearing
- Check `projectInfo` is available in header
- Verify user is on a project page (`/projects/[id]/...`)

### Results not showing
- Check browser console for API errors
- Verify `query.length >= 2`
- Check TanStack Query devtools for query state

### Keyboard navigation not working
- Ensure input is focused
- Check `isOpen` state
- Verify `results.length > 0`
