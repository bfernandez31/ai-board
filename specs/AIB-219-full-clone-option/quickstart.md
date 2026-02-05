# Quickstart: Full Clone Option Implementation

**Feature**: AIB-219 Full Clone Option for Ticket Duplication
**Date**: 2026-02-05

## Implementation Sequence

### Step 1: Branch Operations Utility

**File**: `lib/github/branch-operations.ts` (new file)

Create utility for GitHub branch creation:

```typescript
import { Octokit } from '@octokit/rest';

export async function createBranchFromSource(
  octokit: Octokit,
  owner: string,
  repo: string,
  sourceBranch: string,
  newBranchName: string
): Promise<{ commitSha: string; ref: string }> {
  // 1. Get source branch SHA
  // 2. Create new ref pointing to same SHA
  // 3. Return result
}

export function generateBranchName(ticketNumber: number, title: string): string {
  // Extract first 3 words, slugify
}
```

### Step 2: Database Function

**File**: `lib/db/tickets.ts` (extend existing)

Add `fullCloneTicket()` function alongside existing `duplicateTicket()`:

```typescript
export async function fullCloneTicket(
  projectId: number,
  sourceTicketId: number,
  newBranch: string
): Promise<Ticket & { jobs: Job[] }> {
  // 1. Fetch source ticket with jobs
  // 2. Generate new ticket data with "Clone of " prefix
  // 3. Use $transaction to create ticket + copy all jobs
  // 4. Return new ticket with jobs
}
```

### Step 3: API Endpoint Extension

**File**: `app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts` (extend existing)

Modify POST handler to accept `mode` parameter:

```typescript
// Parse mode from request body
const { mode = 'simple' } = await request.json().catch(() => ({}));

if (mode === 'full') {
  // 1. Validate source has branch
  // 2. Get GitHub credentials
  // 3. Create new branch via createBranchFromSource()
  // 4. Call fullCloneTicket() with new branch name
  // 5. Return ticket with jobs
} else {
  // Existing simple copy logic
}
```

### Step 4: UI Dropdown

**File**: `components/board/ticket-detail-modal.tsx` (modify existing)

Replace Duplicate button with DropdownMenu:

```tsx
// Replace Button with DropdownMenu
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm">
      <ChevronDown className="w-3 h-3 mr-1" />
      Duplicate
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={handleSimpleCopy}>
      Simple copy
    </DropdownMenuItem>
    {showFullClone && (
      <DropdownMenuItem onClick={handleFullClone}>
        Full clone
      </DropdownMenuItem>
    )}
  </DropdownMenuContent>
</DropdownMenu>
```

## Testing Strategy

### Unit Tests (`tests/unit/`)

1. `lib/branch-slug.test.ts` - Branch name generation
   - Slugifies title correctly
   - Handles special characters
   - Limits to 3 words

### Integration Tests (`tests/integration/`)

2. `tickets/duplicate.test.ts` - Extend existing
   - Full clone creates ticket with correct stage
   - Full clone copies all jobs with telemetry
   - Full clone fails without source branch

### E2E Tests (`tests/e2e/`)

3. `ticket-duplication.spec.ts` - Dropdown interaction
   - Dropdown shows correct options per stage
   - Full clone not visible on INBOX/SHIP

## Key Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `lib/github/branch-operations.ts` | CREATE | GitHub branch creation |
| `lib/db/tickets.ts` | MODIFY | Add fullCloneTicket() |
| `app/api/.../duplicate/route.ts` | MODIFY | Handle mode parameter |
| `components/board/ticket-detail-modal.tsx` | MODIFY | Replace button with dropdown |
| `tests/unit/lib/branch-slug.test.ts` | CREATE | Unit test for branch naming |
| `tests/integration/tickets/duplicate.test.ts` | MODIFY | Add full clone tests |
| `tests/e2e/ticket-duplication.spec.ts` | CREATE | Dropdown E2E test |

## Dependencies

- `@octokit/rest` - Already installed
- `shadcn/ui DropdownMenu` - Already available
- No new dependencies required
