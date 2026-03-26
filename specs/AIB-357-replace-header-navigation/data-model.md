# Data Model: Replace Header Navigation with Collapsible Icon Rail Sidebar + Cmd+K Command Palette

## Overview

This feature introduces no Prisma schema changes. It adds presentation and API response models that derive from existing `Project` and `Ticket` records.

## Entities

### ProjectNavigationDestination

Represents a desktop-rail and command-palette destination for a project page.

| Field | Type | Source | Validation |
|-------|------|--------|------------|
| `id` | `'board' \| 'activity' \| 'analytics' \| 'settings'` | Static config | Must be one of the four approved destinations |
| `label` | `string` | Static config | Non-empty, user-visible name |
| `href` | `string` | Derived from `projectId` + route template | Must resolve to `/projects/{projectId}/{segment}` |
| `icon` | `LucideIcon key` | Static config | Must map to an installed icon |
| `group` | `'primary' \| 'secondary' \| 'footer'` | Static config | `settings` must map to `footer` |
| `keywords` | `string[]` | Static config | Lowercased synonyms used for fuzzy matching |
| `isActive` | `boolean` | Derived from current pathname | True only when current page matches supported destination |

### TicketSearchMatch

Represents a searchable ticket entry surfaced by the command palette.

| Field | Type | Source | Validation |
|-------|------|--------|------------|
| `id` | `number` | `Ticket.id` | Positive integer |
| `ticketKey` | `string` | `Ticket.ticketKey` | Existing `{PROJECT_KEY}-{NUMBER}` format |
| `title` | `string` | `Ticket.title` | Existing DB validation applies |
| `stage` | `Stage` | `Ticket.stage` | Existing Prisma enum |
| `href` | `string` | Derived | Must open the board modal URL for the ticket |
| `matchScore` | `number` | Derived | Non-negative rank score used only for sorting |
| `matchType` | `'exact-key' \| 'prefix' \| 'substring' \| 'subsequence'` | Derived | Required for deterministic ordering/tests |

### CommandPaletteResult

Normalized result item returned to the client.

| Field | Type | Source | Validation |
|-------|------|--------|------------|
| `type` | `'destination' \| 'ticket'` | Derived | Required discriminator |
| `id` | `string` | Derived | Unique within a response |
| `label` | `string` | Derived | Non-empty |
| `description` | `string` | Derived | Optional context label for rendering |
| `href` | `string` | Derived | Must navigate within the authorized project |
| `matchScore` | `number` | Derived | Used for stable ordering |

### CommandPaletteResponse

Top-level grouped response returned by the new API route.

| Field | Type | Validation |
|-------|------|------------|
| `query` | `string` | Trimmed string, 0-100 chars |
| `groups.destinations` | `CommandPaletteResult[]` | Sorted descending by `matchScore` |
| `groups.tickets` | `CommandPaletteResult[]` | Sorted descending by `matchScore`, limited server-side |
| `totalCount.destinations` | `number` | `>= 0` |
| `totalCount.tickets` | `number` | `>= 0` |

### CommandPaletteState

Client-only UI state for keyboard and focus management.

| Field | Type | Validation |
|-------|------|------------|
| `open` | `boolean` | Controlled by trigger and global shortcut |
| `query` | `string` | Empty string resets selection |
| `selectedGroup` | `'destinations' \| 'tickets'` | Must track current keyboard focus group |
| `selectedIndex` | `number` | `>= 0`, clamped to visible result count |

## Relationships

- `ProjectNavigationDestination` derives from project route metadata and is scoped by one `projectId`.
- `TicketSearchMatch` derives from existing `Ticket` rows filtered by `projectId` and access control.
- `CommandPaletteResponse` groups zero or more `ProjectNavigationDestination` and `TicketSearchMatch` records for one project query.

## State Transitions

### CommandPaletteState

| From | Event | To |
|------|-------|----|
| `closed` | User clicks header trigger | `open` with input focused |
| `closed` | User presses `Meta+K` or `Ctrl+K` on a project page | `open` with input focused |
| `open` | User types query | `open` with grouped results refreshed |
| `open` | User presses Arrow keys | `open` with updated `selectedGroup` / `selectedIndex` |
| `open` | User presses Enter on selected result | `closed` after navigation |
| `open` | User presses Escape or clicks outside | `closed` without navigation |

## Validation Rules

- Palette query params must be validated with Zod before searching.
- Destination results must never include routes outside the four approved destinations.
- Ticket results must remain constrained to the authorized project.
- The rail must only render on desktop widths and must not expose an expanded state in this feature.
