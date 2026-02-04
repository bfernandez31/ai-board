# Quickstart: Full Clone Option Implementation

**Feature**: AIB-217-full-clone-option
**Estimated Files**: 5 modified, 3 new

## Implementation Order

### Phase 1: Backend - GitHub Branch Creation Utility

**File**: `lib/github/create-branch-from.ts` (NEW)

```typescript
// Signature
export async function createBranchFrom(
  octokit: Octokit,
  owner: string,
  repo: string,
  sourceBranch: string,
  newBranchName: string
): Promise<{ sha: string; ref: string }>
```

**Test**: `tests/unit/create-branch-from.test.ts` (NEW)
- Mock Octokit responses
- Test: successful branch creation
- Test: source branch not found (404)
- Test: permission denied (403)

### Phase 2: Backend - Full Clone Database Function

**File**: `lib/db/tickets.ts` (MODIFY)

```typescript
// Add after existing duplicateTicket function
export async function fullCloneTicket(
  projectId: number,
  sourceTicketId: number,
  githubOwner: string,
  githubRepo: string,
  githubToken: string
): Promise<Ticket & { jobsCloned: number }>
```

**Key Logic**:
1. Fetch source ticket with jobs
2. Validate stage eligibility
3. Generate new ticket number and branch name
4. Create GitHub branch from source
5. Transaction: create ticket + copy jobs
6. Return new ticket with jobs count

### Phase 3: Backend - API Endpoint Extension

**File**: `app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts` (MODIFY)

**Changes**:
1. Parse `fullClone` query parameter
2. If `fullClone=true`:
   - Fetch project for GitHub credentials
   - Call `fullCloneTicket()`
   - Include `jobsCloned` in response
3. If `fullClone=false` (default):
   - Existing `duplicateTicket()` behavior

**Test**: `tests/integration/tickets/clone.test.ts` (NEW)
- Test: full clone creates ticket at same stage
- Test: full clone copies all jobs with telemetry
- Test: full clone fails gracefully for INBOX tickets
- Test: simple copy behavior unchanged

### Phase 4: Frontend - Dropdown Menu Component

**File**: `components/board/ticket-detail-modal.tsx` (MODIFY)

**Changes**:
1. Import DropdownMenu components from shadcn/ui
2. Replace Duplicate button with DropdownMenu
3. Add ChevronDown icon to button
4. Render "Simple copy" and "Full clone" options
5. Conditionally show "Full clone" based on stage

**Location**: Lines ~932-956 (current Duplicate button)

```typescript
// Before: Single button
<Button onClick={handleDuplicate}>Duplicate</Button>

// After: Dropdown menu
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Duplicate <ChevronDown /></Button>
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

### Phase 5: Frontend - Clone Handler Functions

**File**: `components/board/ticket-detail-modal.tsx` (MODIFY)

**Changes**:
1. Rename `handleDuplicate` to `handleSimpleCopy` (keep existing logic)
2. Add `handleFullClone` with `?fullClone=true` query param
3. Update optimistic UI for cloned ticket (preserve stage)
4. Update success toast message for full clone

## File Summary

| File | Action | Lines Changed (Est.) |
|------|--------|---------------------|
| `lib/github/create-branch-from.ts` | NEW | ~60 |
| `lib/db/tickets.ts` | MODIFY | ~80 |
| `app/api/.../duplicate/route.ts` | MODIFY | ~40 |
| `components/board/ticket-detail-modal.tsx` | MODIFY | ~60 |
| `tests/unit/create-branch-from.test.ts` | NEW | ~80 |
| `tests/integration/tickets/clone.test.ts` | NEW | ~100 |

**Total**: ~420 lines

## Key Dependencies

```
@octokit/rest  (existing)
shadcn/ui DropdownMenu (existing)
Prisma $transaction (existing)
```

## Testing Strategy (Testing Trophy)

| Test Type | Files | Coverage |
|-----------|-------|----------|
| Unit | `create-branch-from.test.ts` | GitHub API mocking |
| Integration | `clone.test.ts` | API endpoint + database |
| E2E | None | Dropdown is not browser-required |

## Error Scenarios to Handle

1. Source branch missing in GitHub → 404 BRANCH_NOT_FOUND
2. GitHub token lacks permissions → 403 with helpful message
3. Source ticket in INBOX/SHIP → 400 VALIDATION_ERROR
4. Database transaction failure → 500 DATABASE_ERROR (automatic rollback)
