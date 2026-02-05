# Research: Full Clone Option for Ticket Duplication

**Date**: 2026-02-05
**Status**: Complete

## Research Tasks

### 1. GitHub Branch Creation from Existing Branch

**Decision**: Use Octokit `git.createRef()` API to create branch from source commit SHA

**Rationale**:
- GitHub API provides atomic branch creation via `octokit.rest.git.createRef()`
- Requires: source branch commit SHA, new branch name
- Pattern already used in codebase for `deleteRef()` in `lib/github/delete-branch-and-prs.ts`

**Implementation Pattern**:
```typescript
// Step 1: Get source branch commit SHA
const { data: sourceBranch } = await octokit.rest.repos.getBranch({
  owner,
  repo,
  branch: sourceBranchName,
});
const sourceSha = sourceBranch.commit.sha;

// Step 2: Create new branch pointing to same commit
await octokit.rest.git.createRef({
  owner,
  repo,
  ref: `refs/heads/${newBranchName}`,
  sha: sourceSha,
});
```

**Error Handling**:
- 404: Source branch doesn't exist → return specific error for UI
- 422: Branch already exists → return specific error
- 403: Permission denied → check token scope includes `repo`

**Alternatives Considered**:
- Shell script (`git checkout -b`) - Rejected: requires workflow execution context, not available in API route
- GitHub Actions workflow - Rejected: adds complexity, async, harder error handling

---

### 2. Prisma Transaction for Job Copying

**Decision**: Use `prisma.$transaction()` with nested `createMany()` for atomic job copying

**Rationale**:
- Prisma transactions ensure atomicity (ticket + jobs created together or not at all)
- `createMany()` is more efficient than multiple `create()` calls for batch inserts
- Pattern used in codebase: `lib/workflows/transition.ts:229` for quick-impl

**Implementation Pattern**:
```typescript
const [newTicket, _jobs] = await prisma.$transaction([
  prisma.ticket.create({
    data: { ...ticketData }
  }),
  prisma.job.createMany({
    data: sourceJobs.map(job => ({
      ticketId: newTicket.id, // Reference new ticket
      projectId: job.projectId,
      command: job.command,
      status: job.status,
      branch: newBranchName, // Updated to new branch
      commitSha: job.commitSha,
      logs: job.logs,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      // Telemetry data
      inputTokens: job.inputTokens,
      outputTokens: job.outputTokens,
      cacheReadTokens: job.cacheReadTokens,
      cacheCreationTokens: job.cacheCreationTokens,
      costUsd: job.costUsd,
      durationMs: job.durationMs,
      model: job.model,
      toolsUsed: job.toolsUsed,
    })),
  }),
]);
```

**Challenge**: `createMany` returns count, not created records. For referential integrity, use sequential transaction approach:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Create ticket
  const newTicket = await tx.ticket.create({ data: ticketData });

  // 2. Create jobs with new ticketId
  await tx.job.createMany({
    data: sourceJobs.map(job => ({
      ...jobData,
      ticketId: newTicket.id,
    })),
  });

  return newTicket;
});
```

**Alternatives Considered**:
- Sequential creates without transaction - Rejected: orphaned data on partial failure
- Individual `job.create()` calls - Rejected: less efficient, more DB roundtrips

---

### 3. shadcn/ui DropdownMenu Pattern

**Decision**: Use standard DropdownMenu with DropdownMenuTrigger wrapping existing Button

**Rationale**:
- Pattern already established in `components/project/ProjectMenu.tsx`
- Consistent with UI library conventions
- Accessible by default (keyboard navigation, ARIA)

**Implementation Pattern**:
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm" disabled={isDuplicating}>
      {isDuplicating ? (
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      ) : (
        <ChevronDown className="w-3 h-3 mr-1" />
      )}
      Duplicate
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={handleSimpleCopy}>
      <Copy className="mr-2 h-4 w-4" />
      Simple copy
    </DropdownMenuItem>
    {showFullClone && (
      <DropdownMenuItem onClick={handleFullClone}>
        <GitBranch className="mr-2 h-4 w-4" />
        Full clone
      </DropdownMenuItem>
    )}
  </DropdownMenuContent>
</DropdownMenu>
```

**Stage Visibility Logic**:
```typescript
const showFullClone = ['SPECIFY', 'PLAN', 'BUILD', 'VERIFY'].includes(ticket.stage);
```

**Alternatives Considered**:
- Radio buttons in modal - Rejected: adds extra click, worse UX
- Separate buttons - Rejected: clutters UI, inconsistent with other menus

---

### 4. Branch Name Generation

**Decision**: Use ticket number prefix with slug from title (existing pattern)

**Rationale**:
- Matches existing convention in `create-new-feature.sh`: `{TICKET_NUMBER}-{slug}`
- Example: Source branch `087-feature-name`, cloned to `219-feature-name`
- Slug extraction already implemented

**Implementation Pattern**:
```typescript
function generateBranchName(ticketNumber: number, title: string): string {
  // Extract first 3 words, convert to lowercase, replace spaces with hyphens
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join('-');

  return `${ticketNumber}-${slug}`;
}
```

**Alternatives Considered**:
- Copy source branch name with suffix - Rejected: loses ticket number context
- Random suffix - Rejected: not human-readable

---

### 5. API Endpoint Design

**Decision**: Extend existing `/duplicate` endpoint with `mode` query parameter

**Rationale**:
- Minimal API surface change
- Backwards compatible (default to simple copy)
- Single endpoint for both operations

**Endpoint**:
```
POST /api/projects/{projectId}/tickets/{id}/duplicate?mode=full
```

**Request Body** (optional, for full clone):
```json
{
  "mode": "full"  // "simple" | "full", default "simple"
}
```

**Response** (201 Created):
```json
{
  "id": 456,
  "ticketKey": "AIB-219",
  "title": "Clone of Feature X",
  "stage": "PLAN",
  "branch": "219-feature-x",
  // ... full ticket object
}
```

**Error Responses**:
- 400: Missing source branch (for full clone)
- 404: Ticket/Project not found
- 500: Branch creation failed

**Alternatives Considered**:
- New `/clone` endpoint - Rejected: duplicates auth/validation logic
- Separate `/full-duplicate` endpoint - Rejected: inconsistent naming

---

## Summary

| Topic | Decision | Key Files |
|-------|----------|-----------|
| Branch Creation | Octokit `git.createRef()` | `lib/github/branch-operations.ts` (new) |
| Job Copying | Prisma `$transaction` with `createMany` | `lib/db/tickets.ts` |
| UI Component | shadcn/ui DropdownMenu | `components/board/ticket-detail-modal.tsx` |
| Branch Naming | `{ticketNumber}-{slug}` | `lib/db/tickets.ts` |
| API Design | Extend `/duplicate` with `mode` param | `app/api/.../duplicate/route.ts` |

All research items resolved. Ready for Phase 1 design.
