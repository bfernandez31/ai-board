# Research: Full Clone Option for Ticket Duplication

**Feature**: AIB-217-full-clone-option
**Date**: 2026-02-04

## Research Tasks

### 1. GitHub API Branch Creation from Existing Branch

**Context**: Full clone requires creating a new branch from the source ticket's existing branch.

**Decision**: Use Octokit `git.createRef()` with SHA from source branch

**Rationale**: The GitHub REST API creates branches via refs. To fork from an existing branch:
1. Get the SHA of the source branch using `repos.getBranch()`
2. Create a new ref pointing to that SHA using `git.createRef()`

**Implementation Pattern**:
```typescript
// Step 1: Get source branch SHA
const sourceBranch = await octokit.rest.repos.getBranch({
  owner,
  repo,
  branch: sourceTicket.branch, // e.g., "123-feature"
});

// Step 2: Create new branch from that SHA
const newBranch = await octokit.rest.git.createRef({
  owner,
  repo,
  ref: `refs/heads/${newBranchName}`, // Must be fully qualified
  sha: sourceBranch.data.commit.sha,
});
```

**Error Handling**:
- 404: Source branch doesn't exist → return user-friendly error
- 422: Branch name already exists → should not happen with unique ticket numbers
- 403: Permission denied → token lacks repo access

**Alternatives Considered**:
1. GitHub CLI (`gh api`) - Rejected: Octokit already used in codebase, provides type safety
2. Direct fetch to API - Rejected: Octokit provides error handling and auth management

**Sources**:
- [GitHub Community Discussion #88628](https://github.com/orgs/community/discussions/88628)
- [Octokit createRef Documentation](https://github.com/octokit/plugin-rest-endpoint-methods.js/blob/main/docs/git/createRef.md)
- [Octokit Discussion #2198](https://github.com/octokit/octokit.js/discussions/2198)

---

### 2. Prisma Transaction for Multi-Table Atomicity

**Context**: Full clone creates ticket + multiple jobs. Must be atomic (all succeed or all fail).

**Decision**: Use Prisma interactive transaction with `$transaction()` callback

**Rationale**: Prisma's interactive transaction allows multiple operations within a single database transaction, ensuring rollback on any failure.

**Implementation Pattern**:
```typescript
const result = await prisma.$transaction(async (tx) => {
  // Create new ticket
  const newTicket = await tx.ticket.create({
    data: { ... }
  });

  // Copy all jobs with new ticketId
  const sourceJobs = await tx.job.findMany({
    where: { ticketId: sourceTicketId }
  });

  await tx.job.createMany({
    data: sourceJobs.map(job => ({
      ...job,
      id: undefined, // Auto-generate new ID
      ticketId: newTicket.id,
      createdAt: undefined, // Reset timestamps
      updatedAt: undefined,
    }))
  });

  return newTicket;
});
```

**Alternatives Considered**:
1. Sequential creates without transaction - Rejected: Could leave orphaned jobs if ticket creation fails
2. Nested writes - Rejected: `createMany` doesn't support nested relations

---

### 3. Dropdown Menu UX Pattern

**Context**: Need to replace single Duplicate button with dropdown offering two options.

**Decision**: Use shadcn/ui DropdownMenu with Button as trigger

**Rationale**: Constitution mandates shadcn/ui for UI primitives. Existing patterns in codebase (UserMenu, ProjectMenu) demonstrate the correct usage.

**Implementation Pattern**:
```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm" disabled={isDuplicating}>
      <Copy className="w-3 h-3 mr-1" />
      Duplicate
      <ChevronDown className="w-3 h-3 ml-1" />
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

**Conditional Display Logic** (FR-003, FR-004):
```typescript
const showFullClone = ['SPECIFY', 'PLAN', 'BUILD', 'VERIFY'].includes(ticket.stage);
```

**Alternatives Considered**:
1. Separate buttons - Rejected: Takes more space, less intuitive grouping
2. Modal with options - Rejected: Over-engineered for 2 options

---

### 4. API Design: Extend Duplicate vs. New Endpoint

**Context**: Should full clone extend the existing `/duplicate` endpoint or use a new `/clone` endpoint?

**Decision**: Extend existing `/duplicate` endpoint with `fullClone` query parameter

**Rationale**:
- Maintains backward compatibility (default behavior unchanged)
- Single endpoint for all duplication operations
- Follows REST convention of query params for variations

**Implementation Pattern**:
```typescript
// POST /api/projects/[projectId]/tickets/[id]/duplicate?fullClone=true
const { searchParams } = new URL(request.url);
const fullClone = searchParams.get('fullClone') === 'true';

if (fullClone) {
  return await fullCloneTicket(projectId, ticketId);
} else {
  return await duplicateTicket(projectId, ticketId);
}
```

**Alternatives Considered**:
1. New `/clone` endpoint - Rejected: Creates API fragmentation, requires separate tests
2. Request body parameter - Rejected: Changes POST semantics, breaks backward compat

---

### 5. Job Telemetry Deep Copy Fields

**Context**: Full clone must copy all job data including telemetry (FR-007, FR-008).

**Decision**: Copy all Job fields except `id`, `createdAt`, `updatedAt` (auto-generated)

**Fields to Copy**:
- Core: `command`, `status`, `branch`, `commitSha`, `logs`, `startedAt`, `completedAt`
- Telemetry: `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheCreationTokens`, `costUsd`, `durationMs`, `model`, `toolsUsed`
- Reference: `projectId` (same), `ticketId` (new)

**Implementation Pattern**:
```typescript
const jobCopies = sourceJobs.map(job => {
  const { id, createdAt, updatedAt, ...jobData } = job;
  return {
    ...jobData,
    ticketId: newTicket.id,
  };
});
```

**Alternatives Considered**:
1. Selective field copying - Rejected: User wants complete history for alternative testing
2. Resetting status to PENDING - Rejected: Historical accuracy more valuable

---

### 6. Branch Naming for Cloned Tickets

**Context**: Cloned tickets need new branches following existing convention.

**Decision**: Use existing slug generation pattern: `{ticketNumber}-{slugified-title}`

**Rationale**:
- Maintains consistency with workflow-created branches
- Unique ticket numbers guarantee unique branch names

**Implementation Pattern**:
```typescript
function generateBranchName(ticketNumber: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50); // Reasonable length limit
  return `${ticketNumber}-${slug}`;
}
```

**Alternatives Considered**:
1. Append `-clone` suffix - Rejected: Doesn't follow existing pattern
2. Random suffix - Rejected: Less readable, harder to identify

---

## Summary

All technical unknowns have been resolved:

| Unknown | Resolution |
|---------|------------|
| GitHub branch creation | Octokit `git.createRef()` with SHA from `repos.getBranch()` |
| Transaction atomicity | Prisma `$transaction()` callback for ticket + jobs |
| UI dropdown pattern | shadcn/ui DropdownMenu with conditional Full clone option |
| API design | Extend `/duplicate` endpoint with `?fullClone=true` query param |
| Job copy strategy | Deep copy all fields except auto-generated IDs/timestamps |
| Branch naming | `{ticketNumber}-{slugified-title}` pattern |
