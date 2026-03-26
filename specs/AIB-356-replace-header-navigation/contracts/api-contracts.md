# API Contracts: Replace Header Navigation with Icon Rail Sidebar + Command Palette

**Branch**: `AIB-356-replace-header-navigation` | **Date**: 2026-03-26

## Overview

No new API endpoints are required. This feature reuses the existing ticket search endpoint.

## Existing Endpoint Reused

### GET `/api/projects/{projectId}/tickets/search`

**Purpose**: Ticket search for the command palette's "Tickets" result group.

**Request**:
```
GET /api/projects/{projectId}/tickets/search?q={query}&limit={limit}
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| q | string | Yes | — | Search query (min 2 characters) |
| limit | number | No | 10 | Max results (max 50) |

**Response** (200 OK):
```json
{
  "results": [
    {
      "id": 123,
      "ticketKey": "AIB-123",
      "title": "Add dark mode support",
      "stage": "BUILD",
      "priority": "P1"
    }
  ],
  "totalCount": 1
}
```

**Integration**: The command palette uses the existing `useTicketSearch(projectId, query)` hook which wraps this endpoint with TanStack Query caching and 300ms debounce.

## Client-Side Navigation Data

Navigation items are statically defined — no API call needed:

```typescript
const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: 'board', label: 'Board', icon: LayoutDashboard, href: '/board', group: 'views' },
  { id: 'activity', label: 'Activity', icon: Activity, href: '/activity', group: 'views' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/analytics', group: 'views' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings', group: 'bottom' },
];
```

These are filtered client-side by `cmdk`'s built-in fuzzy matching — no server round-trip for navigation search.

## Component Contracts

### CommandPalette Props
```typescript
interface CommandPaletteProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

### IconRailSidebar Props
```typescript
interface IconRailSidebarProps {
  projectId: number;
}
```

### SearchTrigger Props
```typescript
interface SearchTriggerProps {
  onClick: () => void;
}
```
