# Data Model: Show Duplicated Ticket

**Feature Branch**: `AIB-145-show-duplicated-ticket`
**Date**: 2026-01-05

## Overview

**No new entities or schema changes required.**

This is a client-side cache management bug fix. The existing `Ticket` entity and duplicate API endpoint remain unchanged.

## Existing Entities (Reference)

### Ticket

Used by the duplicate functionality:

| Field | Type | Notes |
|-------|------|-------|
| id | number | Primary key |
| ticketNumber | number | Auto-increment per project |
| ticketKey | string | Format: `{PROJECT_KEY}-{NUMBER}` |
| title | string | Duplicated with "Copy of " prefix |
| description | string | Copied to new ticket |
| stage | Stage | Set to INBOX on duplicate |
| version | number | Set to 1 on duplicate |
| projectId | number | Same as source ticket |
| branch | string? | Set to null on duplicate |
| attachments | JSON | Copied to new ticket |
| clarificationPolicy | enum? | Copied to new ticket |

## Cache Structure (Client-Side)

### Query Key Hierarchy

```
['projects']                           # All projects
['projects', projectId]                # Single project
['projects', projectId, 'tickets']     # All tickets for project ← INVALIDATION TARGET
['projects', projectId, 'tickets', ticketId]  # Single ticket
```

### Cache Update Flow (After Fix)

1. User clicks Duplicate button
2. Optimistic update adds temporary ticket to `['projects', projectId, 'tickets']`
3. API creates real ticket in database
4. `onSuccess` invalidates `['projects', projectId, 'tickets']`
5. Re-fetch replaces temporary ticket with real ticket data

## Validation Rules

No new validation rules. Existing duplicate endpoint validation remains:
- Source ticket must exist
- User must have project access
- Title truncation: "Copy of " + original title, max 100 chars
