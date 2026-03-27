# Data Model: Replace Header Navigation with Icon Rail Sidebar + Command Palette

**Branch**: `AIB-356-replace-header-navigation` | **Date**: 2026-03-26

## Overview

This feature is purely UI/frontend — no database schema changes required. All entities are client-side TypeScript interfaces used for component props and rendering logic.

## Client-Side Entities

### NavigationItem

Represents a project page destination rendered in the icon rail and command palette navigation group.

```typescript
interface NavigationItem {
  /** Unique identifier for the navigation item */
  id: string;
  /** Display label (e.g., "Board", "Analytics") */
  label: string;
  /** lucide-react icon component */
  icon: LucideIcon;
  /** Route path relative to project (e.g., "/board", "/analytics") */
  href: string;
  /** Group placement: "views" (top section) or "bottom" (anchored) */
  group: 'views' | 'bottom';
}
```

**Static data** (not stored in DB):

| id | label | icon | href | group |
|----|-------|------|------|-------|
| board | Board | LayoutDashboard | /projects/{id}/board | views |
| activity | Activity | Activity | /projects/{id}/activity | views |
| analytics | Analytics | BarChart3 | /projects/{id}/analytics | views |
| settings | Settings | Settings | /projects/{id}/settings | bottom |

### CommandPaletteResult

Represents a searchable item in the command palette. Union of navigation results and ticket results.

```typescript
interface CommandPaletteNavigationResult {
  type: 'navigation';
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

interface CommandPaletteTicketResult {
  type: 'ticket';
  id: number;
  ticketKey: string;
  title: string;
  href: string;
}

type CommandPaletteResult = CommandPaletteNavigationResult | CommandPaletteTicketResult;
```

### Existing Entity Reuse

- **SearchResult** (from `@/app/lib/types/search`): Existing ticket search result type used by `useTicketSearch` hook — reused for ticket results in command palette
- **ProjectInfo** (from `header.tsx`): Existing interface with `id`, `name`, `githubOwner`, `githubRepo` — reused for project context

## Database Changes

**None.** This feature modifies only:
- UI components (header, sidebar, command palette)
- Client-side routing/navigation
- Keyboard event handling

No Prisma schema changes, no new API endpoints, no migration needed.

## State Management

| State | Scope | Mechanism |
|-------|-------|-----------|
| Command palette open/closed | Global (within project) | React state in CommandPalette component |
| Search query | Command palette | Local state with debounce for ticket search |
| Active navigation item | Icon rail | Derived from `usePathname()` |
| Ticket search results | Command palette | `useTicketSearch` hook (TanStack Query) |
| Navigation results | Command palette | Client-side filtering via cmdk built-in |
