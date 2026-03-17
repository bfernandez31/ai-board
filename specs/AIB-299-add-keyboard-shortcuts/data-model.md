# Data Model: AIB-299 Add Keyboard Shortcuts

## Overview

This feature is **purely client-side**. No database schema changes, API endpoints, or server-side modifications are required.

## Client-Side State

### localStorage

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `shortcuts-hint-dismissed` | `"true"` \| absent | absent | Tracks whether user has dismissed the first-visit help overlay |

### Component State (Board)

| State | Type | Owner | Description |
|-------|------|-------|-------------|
| `isNewTicketModalOpen` | `boolean` | `Board` | Controls keyboard-triggered new ticket modal |
| `isShortcutsHelpOpen` | `boolean` | `Board` | Controls keyboard shortcuts help dialog |

### Hook State (useKeyboardShortcuts)

| Parameter | Type | Description |
|-----------|------|-------------|
| `enabled` | `boolean` | Whether shortcuts are active (false when detail modal open) |
| `onNewTicket` | `() => void` | Callback for `N` key |
| `onFocusSearch` | `() => void` | Callback for `S` or `/` key |
| `onColumnNav` | `(column: number) => void` | Callback for `1`-`6` keys |
| `onToggleHelp` | `() => void` | Callback for `?` key |

### Hook State (useHoverCapability)

| Return | Type | Description |
|--------|------|-------------|
| `hasHover` | `boolean` | `true` if device matches `(hover: hover)` media query |

## No New Entities

- No Prisma schema changes
- No new database tables
- No new API endpoints
- No new API contracts
