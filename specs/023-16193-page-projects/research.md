# Phase 0: Research & Technical Decisions

**Feature**: Projects List Page
**Date**: 2025-10-11
**Status**: Complete

## Research Areas

### 1. Next.js 15 App Router Architecture

**Question**: How should we structure the projects list page using Next.js 15 App Router?

**Research Findings**:
- Next.js 15 uses App Router with React Server Components by default
- Server Components reduce client JavaScript and improve initial load performance
- Client Components (`"use client"`) required only for interactivity (hover, click handlers)
- Route structure: `/app/projects/page.tsx` creates `/projects` route

**Decision**: Hybrid approach - Server Component page + Client Component cards
- Server Component (`page.tsx`): Fetches initial project data, reduces hydration cost
- Client Component (`ProjectCard`): Handles hover effects and navigation interactions

**Rationale**:
- Server Components provide faster initial page loads
- Client boundaries are explicit and minimal (only interactive cards)
- Follows Next.js 15 best practices and constitution principle II

**Alternatives Rejected**:
- Fully Client-Side: Unnecessary JavaScript, slower initial render
- Fully Server-Side: Cannot handle CSS transitions and hover states effectively

---

### 2. Data Fetching Strategy

**Question**: Should we fetch projects via API route or direct database query?

**Research Findings**:
- Next.js App Router allows direct Prisma queries in Server Components
- API routes add HTTP overhead but enable client-side data fetching if needed
- Constitution requires API routes for consistency (`/app/api/[resource]/route.ts`)

**Decision**: API route (`GET /api/projects`) + Server Component fetch

**Rationale**:
- Aligns with constitution principle II (API routes standard)
- Enables future client-side refresh without page reload
- Consistent with existing `/api/projects/[projectId]/tickets` patterns
- Provides testable contract boundary

**Implementation**:
```typescript
// Server Component fetch
const response = await fetch(`${baseUrl}/api/projects`, { cache: 'no-store' });
const projects = await response.json();
```

**Alternatives Rejected**:
- Direct Prisma in Server Component: Violates API route consistency
- SWR/React Query: Overkill for this static list (no real-time updates required)

---

### 3. Ticket Count Computation

**Question**: How to efficiently compute ticket counts for each project?

**Research Findings**:
- Prisma supports relation counting via `_count` field
- Single query with `include: { _count: { select: { tickets: true } } }`
- Database-level aggregation is more efficient than application-level counting

**Decision**: Prisma `_count` aggregation in API route

**Example Query**:
```typescript
const projects = await prisma.project.findMany({
  include: {
    _count: {
      select: { tickets: true }
    }
  },
  orderBy: { updatedAt: 'desc' }
});

// Transform to API response shape
return projects.map(p => ({
  id: p.id,
  name: p.name,
  description: p.description,
  updatedAt: p.updatedAt.toISOString(),
  ticketCount: p._count.tickets
}));
```

**Rationale**:
- Single database query (avoids N+1 problem)
- Type-safe via Prisma generated types
- Efficient aggregation at database level

**Alternatives Rejected**:
- Separate queries per project: N+1 query problem, poor performance
- Manual SQL COUNT: Loses Prisma type safety, violates constitution IV

---

### 4. UI Component Selection

**Question**: Which shadcn/ui components should we use for project cards?

**Research Findings**:
- Existing shadcn/ui components: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Button`
- Constitution forbids custom UI primitives (principle II)
- Board feature already uses `Card` components (`/components/board/board-column.tsx`)

**Decision**: `Card` component family for project items

**Component Structure**:
```tsx
<Card className="transition-transform duration-200 hover:scale-105 cursor-pointer">
  <CardHeader>
    <CardTitle>{project.name}</CardTitle>
    <CardDescription>{project.description}</CardDescription>
  </CardHeader>
  <CardContent>
    <div>Last updated: {formatDate(project.updatedAt)}</div>
    <div>{project.ticketCount} tickets</div>
  </CardContent>
</Card>
```

**Rationale**:
- Reuses existing components (consistency)
- Accessible by default (ARIA attributes included)
- Responsive design built-in
- Aligns with constitution principle II

**Alternatives Rejected**:
- Custom div-based cards: Violates constitution (no custom UI primitives)
- List items (`<li>`): Less semantic for card-style layout
- Third-party card library: Constitution forbids non-shadcn dependencies

---

### 5. Hover Animation Implementation

**Question**: How to implement scale/transform hover effect while maintaining 60fps?

**Research Findings**:
- CSS transforms are GPU-accelerated (best performance)
- TailwindCSS provides `hover:scale-*` utilities
- `transition-transform` enables smooth animations
- JavaScript-based animations add overhead

**Decision**: TailwindCSS utility classes for hover effect

**Implementation**:
```tsx
className="transition-transform duration-200 hover:scale-105 cursor-pointer"
```

**Rationale**:
- GPU-accelerated CSS transforms (60fps guaranteed)
- No JavaScript overhead
- Built-in TailwindCSS support
- `duration-200` (200ms) provides smooth but snappy feel

**Alternatives Rejected**:
- Framer Motion: Overkill for simple hover (adds 52KB bundle)
- CSS keyframes: Less declarative than Tailwind utilities
- JavaScript `requestAnimationFrame`: Unnecessary complexity

---

### 6. Empty State Design

**Question**: What should display when no projects exist?

**Research Findings**:
- Spec requirement (FR-009): Message + call-to-action for Create Project button
- Empty states should guide users to next action
- Check existing board empty states for consistency

**Decision**: Centered empty state component with message

**Component Structure**:
```tsx
<EmptyProjectsState>
  <p>No projects available</p>
  <p>Get started by clicking the "Create Project" button above</p>
</EmptyProjectsState>
```

**Rationale**:
- Matches spec acceptance criterion #7
- Guides users to actionable next step
- Consistent with empty state patterns in codebase

**Alternatives Rejected**:
- Blank page: Poor UX, user doesn't know what to do
- Inline tutorial: Out of scope, spec only requires message
- Illustration: No design system requirement specified

---

### 7. Scrollable Container Strategy

**Question**: How to handle large lists (50+ projects) without pagination?

**Research Findings**:
- Spec clarification: All projects in scrollable container, no pagination
- Virtual scrolling libraries (react-window) optimize large lists
- CSS `overflow-y-auto` sufficient for moderate lists (<1000 items)

**Decision**: CSS-based scrollable container (no virtual scrolling)

**Implementation**:
```tsx
<div className="overflow-y-auto max-h-[calc(100vh-200px)]">
  {projects.map(project => <ProjectCard key={project.id} {...project} />)}
</div>
```

**Rationale**:
- Simple CSS-only solution
- No additional dependencies
- Adequate performance for expected project counts (<100)
- Constitution principle: avoid premature optimization

**Alternatives Rejected**:
- Virtual scrolling (react-window): Premature optimization (YAGNI)
- Infinite scroll: Spec explicitly chose scrollable container
- Pagination: Rejected in clarification session (answer A to Q3)

---

### 8. Navigation Implementation

**Question**: How to navigate to project board when clicking a project?

**Research Findings**:
- Next.js App Router uses `next/navigation` `useRouter` hook
- Existing board route: `/projects/[projectId]/board`
- Client Component required for `onClick` handler

**Decision**: `useRouter().push()` in Client Component click handler

**Implementation**:
```tsx
'use client';
import { useRouter } from 'next/navigation';

export function ProjectCard({ project }) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/projects/${project.id}/board`);
  };

  return <Card onClick={handleClick}>...</Card>;
}
```

**Rationale**:
- Standard Next.js App Router navigation pattern
- Client Component required for event handlers
- Matches existing board navigation pattern

**Alternatives Rejected**:
- `<Link>` component: Less flexible for card click areas
- `window.location`: Causes full page reload (bad UX)
- Server Action: Overkill for simple navigation

---

### 9. Button Placeholder Implementation

**Question**: How to implement non-functional Import/Create buttons?

**Research Findings**:
- Spec requirement (FR-006): Buttons visible but non-functional
- Should maintain modern, clean design
- Icon + text label format (clarification answer C to Q5)

**Decision**: shadcn/ui `Button` components with disabled state styling

**Implementation**:
```tsx
<div className="flex gap-4 mb-6">
  <Button variant="outline" disabled>
    <UploadIcon className="mr-2 h-4 w-4" />
    Import Project
  </Button>
  <Button disabled>
    <PlusIcon className="mr-2 h-4 w-4" />
    Create Project
  </Button>
</div>
```

**Rationale**:
- Uses existing shadcn/ui Button component
- Icons from lucide-react (already in dependencies)
- Disabled state prevents clicks while maintaining visual presence

**Alternatives Rejected**:
- `onClick` handler with no-op: Misleading (appears functional)
- Hidden buttons: Violates spec (must be visible)
- Text-only buttons: Clarification specified icon + text

---

## Summary

All technical decisions resolved. No NEEDS CLARIFICATION markers remain.

**Key Technologies**:
- Next.js 15 App Router (Server + Client Components)
- Prisma aggregation queries
- shadcn/ui components (Card, Button)
- TailwindCSS utilities for styling and animations

**Performance Strategy**:
- Server Component for initial load
- Client Component boundaries minimized
- Single database query with aggregation
- CSS-based animations (GPU-accelerated)

**Architecture Alignment**:
- ✓ TypeScript strict mode
- ✓ Component-driven (shadcn/ui)
- ✓ API route consistency
- ✓ Security by design (read-only)
- ✓ No new dependencies required

Ready for Phase 1: Design & Contracts.
