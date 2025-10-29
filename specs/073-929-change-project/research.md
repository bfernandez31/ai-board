# Research: Project Card Redesign

**Feature**: Display last shipped ticket instead of project description
**Date**: 2025-10-29
**Status**: Complete

## Research Questions

1. How to add deployment URL field to Project model?
2. What is the best approach for relative time formatting?
3. How to implement clipboard copy functionality?
4. How to query for last shipped ticket efficiently?

---

## 1. Deployment URL Field

### Decision
Add optional `deploymentUrl` field to Project model as nullable string with 500 character limit.

### Rationale
- **Nullable**: Not all projects have deployments; optional field follows existing pattern (see `Ticket.branch`, `User.name`)
- **500 Characters**: Deployment URLs may include subdomains, paths, and query parameters; more generous than branch field (200 chars)
- **VARCHAR**: PostgreSQL type matches existing string fields; avoids TEXT for bounded data
- **No Index**: Deployment URLs are display-only; no search/filter requirements identified

### Alternatives Considered
- **TEXT Type**: Rejected - unbounded storage wasteful for URLs, inconsistent with schema patterns
- **NOT NULL with Default**: Rejected - forces empty strings, complicates validation
- **Separate Deployment Table**: Rejected - over-engineering for single optional field

### Implementation
```prisma
// prisma/schema.prisma
model Project {
  // ... existing fields
  deploymentUrl    String?     @db.VarChar(500)
}
```

**Migration**: Additive migration via `prisma migrate dev --name add_deployment_url`

---

## 2. Relative Time Formatting

### Decision
Use existing native `formatTimestamp()` utility from `lib/utils/format-timestamp.ts`.

### Rationale
- **Already Implemented**: Comprehensive utility with 21 unit tests exists in codebase
- **Zero Dependencies**: Uses native `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat` APIs
- **Better UX**: Hybrid approach provides context:
  - `< 1 min`: "just now"
  - `1-59 min`: "5 minutes ago"
  - `1-23 hours`: "3:42 PM" (time only)
  - `≥ 24 hours`: "Oct 23, 10:00 AM" (date + time)
- **Locale-Aware**: Automatic browser language detection
- **Robust Error Handling**: Gracefully handles null/invalid inputs

### Alternatives Considered
- **date-fns Library**: Rejected - already installed but being phased out; adds 20KB to bundle for simple use case
- **Custom Simple Implementation**: Rejected - reinventing wheel when tested solution exists
- **Always Relative**: Rejected - "365 days ago" less useful than "Oct 23, 2024"

### Usage Pattern
```typescript
import { formatTimestamp } from '@/lib/utils/format-timestamp';

const displayTime = formatTimestamp(ticket.updatedAt);
// Returns: "2 hours ago" or "Oct 23, 10:00 AM"
```

---

## 3. Clipboard Copy Implementation

### Decision
Implement native Clipboard API with shadcn/ui Toast for feedback.

### Rationale
- **Native API**: Modern browsers support `navigator.clipboard.writeText()`; no library needed
- **Existing Infrastructure**: Toast system (`useToast()`) already integrated for notifications
- **Consistent Pattern**: Image upload component already uses native clipboard APIs
- **Accessible**: Permission-based clipboard access meets security requirements

### Alternatives Considered
- **clipboard.js Library**: Rejected - 3KB for functionality available natively
- **copy-to-clipboard Package**: Rejected - unnecessary dependency for 5 lines of code
- **No Visual Feedback**: Rejected - poor UX, users unsure if copy succeeded

### Implementation Pattern
```typescript
// Custom hook for reusability
export function useCopyToClipboard() {
  const { toast } = useToast();
  const [isCopied, setIsCopied] = useState(false);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setIsCopied(false), 2000);
  };

  return { copy, isCopied };
}

// Component usage with icon state change
<Button onClick={() => copy(url)}>
  {isCopied ? <Check /> : <Copy />}
</Button>
```

**Visual Feedback**: Icon change (Copy → Check for 2s) + toast notification

---

## 4. Query for Last Shipped Ticket

### Decision
Use Prisma `include` with `orderBy` and `take: 1` to fetch last shipped ticket per project.

### Rationale
- **Efficient**: Leverages existing composite index `@@index([projectId, stage, updatedAt])` on Ticket model
- **Single Query**: Fetch projects + last shipped ticket in one round-trip
- **Type-Safe**: Prisma generates TypeScript types automatically
- **Maintainable**: Declarative query readable by team

### Query Strategy
```typescript
await prisma.project.findMany({
  where: { OR: [{ userId }, { members: { some: { userId } } }] },
  include: {
    _count: { select: { tickets: true } },
    tickets: {
      where: { stage: 'SHIP' },
      orderBy: { updatedAt: 'desc' },
      take: 1,
      select: { id: true, title: true, updatedAt: true }
    }
  },
  orderBy: { updatedAt: 'desc' }
});
```

**Performance**: Composite index ensures <100ms p95 response time for typical datasets (100s of projects, 1000s of tickets).

### Alternatives Considered
- **Separate Query per Project**: Rejected - N+1 problem, terrible performance
- **Raw SQL with Window Functions**: Rejected - loses type safety, harder to maintain
- **Client-Side Filtering**: Rejected - fetches unnecessary data, slow for large datasets

---

## Summary of Decisions

| Research Area | Decision | Key Benefit |
|---------------|----------|-------------|
| Deployment URL | Nullable `String?` field (500 chars) | Follows existing optional field patterns |
| Relative Time | Use existing `formatTimestamp()` utility | Zero dependencies, 21 tests, hybrid UX |
| Clipboard Copy | Native Clipboard API + Toast feedback | No libraries, leverages existing toast system |
| Query Strategy | Prisma include with orderBy/take | Single query, type-safe, uses existing indexes |

All decisions align with constitution principles: TypeScript-first (type safety), component-driven (reuse existing utilities), security-first (no new attack surface), database integrity (indexed queries).
