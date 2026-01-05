# Data Model: Comment with Ticket and Command Autocomplete

**Branch**: `AIB-141-comment-with-ticket` | **Date**: 2026-01-05

## Overview

This feature adds two autocomplete triggers (`#` for tickets, `/` for commands) to the comment textarea. No database schema changes required—leverages existing ticket data and introduces client-side types for commands.

---

## Existing Entities (No Changes)

### Ticket (Prisma Model)

Used for `#` autocomplete. Fields relevant to autocomplete:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Primary key |
| `ticketKey` | String | Display format (e.g., "AIB-120") |
| `title` | String | Ticket title |
| `stage` | Stage | Current workflow stage |
| `projectId` | Int | Parent project (access control) |

**Access Control**: Tickets filtered by `projectId`; access verified via `verifyProjectAccess()`.

### ProjectMember (Existing Type)

Already used for `@` mention autocomplete. No changes needed.

---

## New Types (Client-Side Only)

### AIBoardCommand

Static command definition for `/` autocomplete.

```typescript
interface AIBoardCommand {
  /** Command name with leading slash (e.g., "/compare") */
  name: string;
  /** Short description shown in dropdown */
  description: string;
}
```

**Source**: Static constant `AI_BOARD_COMMANDS` in `app/lib/data/ai-board-commands.ts`.

**Initial Commands**:
| name | description |
|------|-------------|
| `/compare` | Compare ticket implementations for best code quality |

### TicketSearchResult

Lightweight ticket data for autocomplete display.

```typescript
interface TicketSearchResult {
  id: number;
  ticketKey: string;
  title: string;
  stage: string;
}
```

**Source**: `/api/projects/[projectId]/tickets/search` endpoint.

---

## Data Flow

### Ticket Autocomplete (`#`)

```
User types "#" → MentionInput detects trigger
  → useTicketSearch(projectId, query) hook
  → GET /api/projects/{projectId}/tickets/search?q={query}&limit=10
  → TicketSearchResult[] → TicketAutocomplete dropdown
  → User selects → Insert "#{ticketKey}" at cursor
```

### Command Autocomplete (`/`)

```
User types "/" after @ai-board → MentionInput detects trigger
  → Filter AI_BOARD_COMMANDS by query (client-side)
  → AIBoardCommand[] → CommandAutocomplete dropdown
  → User selects → Insert command name at cursor
```

---

## State Transitions

### MentionInput Autocomplete State

```
┌─────────────────────────────────────────────────────────────┐
│                  activeAutocomplete: 'none'                  │
└─────────────────────────────────────────────────────────────┘
          │           │              │
     type '@'    type '#'    type '/' after @ai-board
          ↓           ↓              ↓
┌─────────────┐ ┌───────────┐ ┌──────────────┐
│  'mention'  │ │  'ticket' │ │  'command'   │
└─────────────┘ └───────────┘ └──────────────┘
          │           │              │
    Escape/select/click-outside → 'none'
```

### Trigger Validation Rules

| Trigger | Valid Context | Invalid Context |
|---------|--------------|-----------------|
| `@` | Word boundary (start or after whitespace) | Inside existing mention `@[id:name]` |
| `#` | Word boundary (start or after whitespace) | Inside existing mention markup |
| `/` | After `@[id:AI-BOARD] ` pattern | Anywhere else |

---

## Relationships

```
Project (1) ──────┬──── (N) Ticket
                  │
                  └──── (N) ProjectMember

Comment ──────────────── (contains) ──────────────── Ticket references (#KEY)
                                                     User mentions (@[id:name])
                                                     Commands (/name)
```

---

## Validation Rules

### Ticket Reference

- Format: `#` followed by ticket key (e.g., `#AIB-120`)
- No validation on insert—plain text
- Display component may linkify valid patterns

### Command Reference

- Format: `/` followed by command name (e.g., `/compare`)
- Must immediately follow AI-BOARD mention
- Only valid commands shown in dropdown

---

## Query Keys (TanStack Query)

Existing key already defined:

```typescript
queryKeys.projects.ticketSearch(projectId, query)
// Returns: ['projects', projectId, 'tickets', 'search', query]
```

**Cache Strategy**:
- `staleTime`: 30 seconds (tickets change moderately)
- `gcTime`: 60 seconds
- Invalidated when tickets change in project
