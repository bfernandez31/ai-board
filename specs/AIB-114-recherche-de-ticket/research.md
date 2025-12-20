# Research: Ticket Search Implementation

**Feature**: AIB-114 - Recherche de ticket
**Date**: 2025-12-19
**Status**: Completed

## Research Summary

This document consolidates research findings for implementing a ticket search feature in the AI-Board header.

---

## 1. TanStack Query v5 Search Patterns

### Decision: Use `useQuery` with debounced state
**Rationale**: TanStack Query v5 provides built-in caching and deduplication. Combine with React useState for debounced query parameter to avoid excessive API calls.
**Alternatives considered**:
- useMutation for search (rejected: queries are better for read-only operations)
- Client-side filtering (rejected: doesn't scale, and API already exists)

### Implementation Pattern
```typescript
// Debounce with useState + useEffect
const [searchTerm, setSearchTerm] = useState('');
const [debouncedTerm, setDebouncedTerm] = useState('');

useEffect(() => {
  const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
  return () => clearTimeout(timer);
}, [searchTerm]);

// Query with debounced term
const { data, isLoading, error } = useQuery({
  queryKey: queryKeys.projects.ticketSearch(projectId, debouncedTerm),
  queryFn: () => searchTickets(projectId, debouncedTerm),
  enabled: debouncedTerm.length >= 2,
  staleTime: 30000, // Cache results for 30 seconds
});
```

### Query Key Pattern
```typescript
// Add to queryKeys.projects
ticketSearch: (projectId: number, query: string) =>
  ['projects', projectId, 'tickets', 'search', query] as const,
```

### State Handling
- **Loading**: `isLoading` prop from useQuery when `isFetching && !data`
- **Error**: `error` prop with error boundary or inline message
- **Empty**: Check `data?.length === 0` after successful fetch
- **Disabled**: Query disabled when `query.length < 2`

---

## 2. shadcn/ui Component Strategy

### Decision: Use Popover + Input + custom dropdown list (no cmdk)
**Rationale**: The `cmdk` (Command) component is NOT installed. Using existing Popover + Input + custom list matches the existing mention-input pattern.
**Alternatives considered**:
- Install cmdk/Command component (rejected: adds dependency, existing pattern works)
- DropdownMenu (rejected: designed for actions, not search)

### Available Components (Already Installed)
| Component | Location | Use Case |
|-----------|----------|----------|
| **Input** | `/components/ui/input.tsx` | Search input field |
| **Popover** | `/components/ui/popover.tsx` | Dropdown container |
| **ScrollArea** | `/components/ui/scroll-area.tsx` | Scrollable results list |
| **Tooltip** | `/components/ui/tooltip.tsx` | Loading/error hints |

### Existing Pattern Reference
The mention-input system (`/components/comments/mention-input.tsx`) demonstrates:
- Keyboard navigation (Arrow Up/Down, Enter, Escape)
- Mouse selection with hover states
- Auto-scroll selected item into view
- Click-outside to close
- Styling: `bg-popover`, `border-border`, `shadow-md`, `rounded-md`

### Recommended Component Structure
```
<Popover>
  <PopoverAnchor asChild>
    <Input placeholder="Search tickets..." />
  </PopoverAnchor>
  <PopoverContent>
    <ScrollArea>
      {/* SearchResults component */}
    </ScrollArea>
  </PopoverContent>
</Popover>
```

---

## 3. Prisma Search Patterns

### Decision: Use `contains` with `OR` conditions and client-side relevance sorting
**Rationale**: Matches existing codebase patterns. PostgreSQL `contains` is case-insensitive by default. Avoid full-text search complexity.
**Alternatives considered**:
- PostgreSQL full-text search (tsvector) - rejected: overkill for small datasets
- Client-side filtering - rejected: already have server patterns

### Search Query Pattern
```typescript
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
  take: 10,
  orderBy: { updatedAt: 'desc' },
});
```

### Relevance Sorting (Client-Side)
```typescript
// Sort results: exact key match > key contains > title contains > description contains
results.sort((a, b) => {
  const queryLower = query.toLowerCase();

  // Exact key match = highest priority
  const aKeyExact = a.ticketKey.toLowerCase() === queryLower ? 4 : 0;
  const bKeyExact = b.ticketKey.toLowerCase() === queryLower ? 4 : 0;

  // Key contains = high priority
  const aKeyContains = a.ticketKey.toLowerCase().includes(queryLower) ? 3 : 0;
  const bKeyContains = b.ticketKey.toLowerCase().includes(queryLower) ? 3 : 0;

  // Title contains = medium priority
  const aTitleContains = a.title.toLowerCase().includes(queryLower) ? 2 : 0;
  const bTitleContains = b.title.toLowerCase().includes(queryLower) ? 2 : 0;

  const aScore = aKeyExact || aKeyContains || aTitleContains || 1;
  const bScore = bKeyExact || bKeyContains || bTitleContains || 1;

  return bScore - aScore; // Higher score first
});
```

### Database Indexes (Already Exist)
- `@@index([projectId])` - filters by project
- `@@index([ticketKey])` - key lookups
- `@@index([updatedAt])` - sorting by recency

Note: `contains` queries don't use indexes efficiently. For larger datasets, consider:
- Limiting results with `take: 10`
- Adding trigram index (pg_trgm extension) if performance degrades

---

## 4. Keyboard Navigation Implementation

### Decision: Manual keyboard handling with data attributes
**Rationale**: Matches existing mention-input pattern. Full control over behavior without external library.

### Implementation Pattern
```typescript
const [selectedIndex, setSelectedIndex] = useState(0);

const handleKeyDown = (e: KeyboardEvent) => {
  if (!isOpen || results.length === 0) return;

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
        onSelectTicket(results[selectedIndex]);
      }
      break;
    case 'Escape':
      e.preventDefault();
      setIsOpen(false);
      break;
  }
};

// Auto-scroll selected item into view
useEffect(() => {
  const selectedElement = document.querySelector('[data-selected="true"]');
  selectedElement?.scrollIntoView({ block: 'nearest' });
}, [selectedIndex]);
```

---

## 5. Header Integration

### Decision: Conditional rendering based on projectInfo availability
**Rationale**: Search only makes sense within a project context. Header already has projectInfo state.

### Placement Strategy
- Position: Center of header, between logo and right-side controls
- Visibility: Only when `projectInfo` is available (user is on a project page)
- Responsive: Hide on mobile (< md breakpoint) or use compact mode

### Component Integration Point
```typescript
// In header.tsx
{projectInfo && (
  <>
    {/* Existing project info */}
    <TicketSearch projectId={projectInfo.id} />
  </>
)}
```

---

## 6. Modal Integration

### Decision: Use existing TicketDetailModal with URL-based state
**Rationale**: Maintains consistency with board behavior where clicking a ticket opens the modal.

### Integration Pattern
```typescript
// Use router to update URL, which triggers modal
const router = useRouter();
const searchParams = useSearchParams();

const handleSelectTicket = (ticket: SearchResult) => {
  // Update URL to open modal
  const params = new URLSearchParams(searchParams);
  params.set('ticket', ticket.id.toString());
  router.push(`?${params.toString()}`);

  // Clear search and close dropdown
  setSearchTerm('');
  setIsOpen(false);
};
```

---

## Summary of Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Query Hook | TanStack Query + useState debounce | Built-in caching, matches codebase patterns |
| UI Components | Popover + Input + custom list | Uses existing components, no new dependencies |
| Search Backend | Prisma `contains` with OR | Case-insensitive, existing pattern |
| Relevance | Client-side sorting | Flexible, performant for small results |
| Keyboard | Manual with data attributes | Full control, matches mention-input |
| Modal | URL-based state | Consistent with board behavior |

---

## Files to Create/Modify

### New Files
1. `/components/search/ticket-search.tsx` - Main search component
2. `/components/search/search-results.tsx` - Dropdown results list
3. `/app/api/projects/[projectId]/tickets/search/route.ts` - Search API endpoint
4. `/app/lib/hooks/queries/useTicketSearch.ts` - TanStack Query hook

### Modified Files
1. `/components/layout/header.tsx` - Add TicketSearch component
2. `/app/lib/query-keys.ts` - Add ticketSearch query key
