# Research: Clean Workflow Implementation

**Feature**: Clean Workflow
**Branch**: 090-1492-clean-workflow
**Date**: 2025-11-21

## Purpose

This document consolidates research findings for implementing the Clean Workflow feature, which provides automated technical debt cleanup using Claude Code CLI to analyze and fix code, tests, and documentation from recently shipped features.

---

## Research Area 1: Transition Lock Mechanism

### Decision: Lock Storage Strategy

**Approach**: Project-level nullable field in database

Add `activeCleanupJobId Int?` to Project model:

```prisma
model Project {
  // ... existing fields ...
  activeCleanupJobId Int? // Nullable foreign key to Job
  // ... rest of fields ...
}
```

**Rationale**:
- Minimal schema changes (single optional field)
- Follows existing patterns (project-level fields like `clarificationPolicy`)
- Database integrity via foreign key relationship
- Automatic cleanup on job deletion (cascade)
- Single query performance (no joins)
- Full auditability

**Alternatives Rejected**:
- Separate `TransitionLock` model: Overengineered for boolean state
- Redis/In-memory: Adds infrastructure dependency, orphaned lock risks
- Field on Ticket: Lock is project-wide, not ticket-specific

### Decision: Lock Check Implementation

**Approach**: Early validation in transition API route

Location: `/app/api/projects/[projectId]/tickets/[id]/transition/route.ts`

```typescript
// After fetching ticket, before transition logic
const project = await prisma.project.findUnique({
  where: { id: projectId },
  select: { activeCleanupJobId: true }
});

if (project?.activeCleanupJobId) {
  const cleanupJob = await prisma.job.findUnique({
    where: { id: project.activeCleanupJobId },
    select: { status: true }
  });

  if (cleanupJob && (cleanupJob.status === 'PENDING' || cleanupJob.status === 'RUNNING')) {
    return NextResponse.json(
      {
        error: 'Project cleanup is in progress. Stage transitions are temporarily disabled.',
        code: 'CLEANUP_IN_PROGRESS'
      },
      { status: 423 } // HTTP 423 Locked
    );
  }

  // Self-healing: clear lock if job terminal
  if (cleanupJob && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(cleanupJob.status)) {
    await prisma.project.update({
      where: { id: projectId },
      data: { activeCleanupJobId: null }
    });
  }
}
```

**Rationale**:
- Single enforcement point (all transitions go through this route)
- Follows existing validation patterns (rollback validation)
- HTTP 423 Locked is standard for resource locking
- Self-healing mechanism handles orphaned locks

**Alternatives Rejected**:
- Prisma middleware: Affects all updates, harder to return HTTP errors
- Next.js middleware: Runs before route handlers, complicates param extraction

### Decision: Lock Lifecycle

**Acquisition**: During cleanup ticket creation (atomic transaction)

```typescript
const result = await prisma.$transaction(async (tx) => {
  const cleanupTicket = await tx.ticket.create({
    data: { title: `Clean ${new Date().toISOString().split('T')[0]}`, ... }
  });

  const job = await tx.job.create({
    data: { ticketId: cleanupTicket.id, command: 'clean', ... }
  });

  await tx.project.update({
    where: { id: projectId },
    data: { activeCleanupJobId: job.id }
  });

  return { ticket: cleanupTicket, job };
});
```

**Release**: Three paths
1. **Normal**: Workflow updates job to terminal state → lock released
2. **Lazy cleanup**: Transition attempts detect terminal state and clear lock
3. **Manual override**: Admin endpoint for orphaned locks (optional)

In `/app/api/jobs/[id]/status/route.ts`, add after job update:

```typescript
if (isTerminalState) {
  const project = await prisma.project.findFirst({
    where: { activeCleanupJobId: jobId }
  });

  if (project) {
    await prisma.project.update({
      where: { id: project.id },
      data: { activeCleanupJobId: null }
    });
  }
}
```

**Rationale**:
- Atomic creation prevents partial state
- Multiple release paths ensure reliability
- Self-healing prevents orphaned locks

### Decision: User Feedback

**Communication Strategy**:

1. **API Error Response**: HTTP 423 with clear message
   ```json
   {
     "error": "Project cleanup is in progress. Stage transitions are temporarily disabled.",
     "code": "CLEANUP_IN_PROGRESS",
     "status": 423
   }
   ```

2. **Board-Level Banner**: Warning indicator at top of board
   ```tsx
   {project.activeCleanupJobId && (
     <CleanupInProgressBanner
       projectId={projectId}
       jobId={project.activeCleanupJobId}
     />
   )}
   ```

3. **Drag-and-Drop Prevention**: Show toast before transition attempt
   ```typescript
   if (project.activeCleanupJobId) {
     toast({
       title: "Transition blocked",
       description: "Project cleanup is in progress. Please wait for it to complete.",
       variant: "warning"
     });
     return;
   }
   ```

4. **Polling Integration**: Use existing `useJobPolling` hook (2-second interval)

**Rationale**:
- Leverages existing job polling infrastructure
- Clear, non-blocking communication
- Automatic resolution when cleanup completes
- Users can still update ticket content (descriptions, docs, previews)

---

## Research Area 2: Shipped Branch Identification

### Decision: Last Clean Detection

**Approach**: Query tickets for most recent CLEAN ticket by creation date

```typescript
const lastCleanTicket = await prisma.ticket.findFirst({
  where: {
    projectId,
    workflowType: 'CLEAN',
    stage: { in: ['BUILD', 'VERIFY', 'SHIP'] } // Exclude INBOX rollbacks
  },
  orderBy: { createdAt: 'desc' },
  select: { createdAt: true, ticketKey: true }
});

const lastCleanDate = lastCleanTicket?.createdAt || new Date(0); // Epoch if first cleanup
```

**Rationale**:
- Uses existing `WorkflowType` enum (consistent with FULL/QUICK pattern)
- Ticket title "Clean [YYYY-MM-DD]" provides self-documentation
- Complete audit trail of cleanup history
- Efficient query using indexed fields
- No schema changes needed

**Alternatives Rejected**:
- Project.lastCleanupDate field: Loses history, requires migration
- Job.completedAt query: Jobs are implementation details, can be deleted
- Regex on title: Fragile, no type safety

### Decision: Shipped Branch Query

**Approach**: Query tickets where stage=SHIP and updatedAt > lastCleanDate

```typescript
export async function getShippedBranchesSinceLastClean(
  projectId: number,
  lastCleanDate: Date
): Promise<string[]> {
  const shippedTickets = await prisma.ticket.findMany({
    where: {
      projectId,
      stage: 'SHIP',
      updatedAt: { gt: lastCleanDate }, // Greater than (not gte)
      branch: { not: null }
    },
    select: { branch: true, ticketKey: true, title: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' }
  });

  return shippedTickets
    .filter(ticket => ticket.branch !== null)
    .map(ticket => ticket.branch as string);
}
```

**Rationale**:
- Uses indexed fields (`stage`, `updatedAt`, `projectId`)
- `updatedAt` automatically updates on stage transitions (Prisma `@updatedAt`)
- Filters null branches (INBOX tickets may lack branches)
- Consistent with existing codebase patterns

**Edge Cases Handled**:
- Tickets moved after SHIP: Won't match `stage: 'SHIP'` filter
- Concurrent cleanups: Using `gt` (not `gte`) excludes cleanup ticket itself
- Multiple transitions: Only current state matters

**Alternatives Rejected**:
- Track stage transition history: Significant complexity, not needed for MVP
- Last 30 days only: Arbitrary cutoff could miss important debt
- User-specified range: Adds UI complexity not in spec

### Decision: Branch Validation

**Approach**: Three-tier validation (database, Git rules, length)

```typescript
export function validateBranches(branches: string[]): string[] {
  return branches.filter(branch => {
    // Tier 1: Non-empty
    if (!branch || branch.trim() === '') return false;

    // Tier 2: Git branch name rules
    const invalidChars = /[~^:\\*?\[\]@{}]/;
    if (invalidChars.test(branch)) return false;
    if (branch.startsWith('-') || branch.endsWith('.lock') || branch === '@') return false;

    // Tier 3: Length (matches DB VARCHAR(200))
    if (branch.length > 200) return false;

    return true;
  });
}
```

**Rationale**:
- Database schema already enforces `VARCHAR(200)` constraint
- Branches created by GitHub workflows are already valid (defensive validation)
- No need to check remote Git (adds latency, race conditions)
- Workflow handles missing branches gracefully

**Alternatives Rejected**:
- GitHub API call to verify branch exists: Performance overhead, race conditions
- Git ls-remote check: Unnecessary complexity, workflow responsibility

### Decision: First-Time Cleanup

**Approach**: Use epoch (1970-01-01) as default, include all shipped tickets

```typescript
export async function getLastCleanupDate(projectId: number): Promise<Date> {
  const lastCleanTicket = await prisma.ticket.findFirst({
    where: {
      projectId,
      workflowType: 'CLEAN',
      stage: { in: ['BUILD', 'VERIFY', 'SHIP'] }
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true }
  });

  return lastCleanTicket?.createdAt || new Date(0); // Unix epoch
}
```

**Rationale**:
- Safe default: First cleanup analyzes ALL shipped tickets
- No user configuration needed
- Transparent (users see branch list in ticket description)
- Matches spec: "since previous cleanup" = beginning of time for first run

**Alternatives Rejected**:
- Last 30 days only: Arbitrary, could miss important debt
- User-specified range: Extra UI complexity
- Project creation date: Would analyze unshipped tickets

---

## Research Area 3: Claude Code Cleanup Analysis

### Decision: Claude Code Invocation

**Command Structure**: New `/cleanup` slash command

**File**: `.claude/commands/cleanup.md`

**Invocation**:
```bash
claude --dangerously-skip-permissions "/cleanup $payload"
```

**Payload Structure**:
```json
{
  "shippedBranches": ["090-feature-a", "091-feature-b", "092-feature-c"],
  "analysisScope": {
    "code": true,
    "tests": true,
    "documentation": true
  },
  "constraints": {
    "noBehaviorChanges": true,
    "requireTestsPassing": true
  }
}
```

**Passing Branches via JSON File**:
```bash
cat > /tmp/cleanup_payload.json <<'EOF'
{"shippedBranches": [...], ...}
EOF
payload=$(cat /tmp/cleanup_payload.json)
claude --dangerously-skip-permissions "/cleanup $payload IMPORTANT: Analyze technical debt from shipped branches..."
```

**Rationale**:
- Follows existing patterns (speckit.yml uses payload files)
- Avoids bash escaping issues
- Supports complex JSON structures
- `--dangerously-skip-permissions` required for CI/CD (used in all workflows)

**Alternatives Rejected**:
- Reuse `/quick-impl`: Semantic confusion, different analysis patterns
- Environment variables: Less structured, harder to pass complex data
- Command-line args: Escaping issues with branch names

### Decision: Analysis Scope

**Multi-Layer Approach**:

**Layer 1: Git Diff Analysis** (Primary)
```bash
for branch in ${shippedBranches[@]}; do
  git log main..$branch --oneline --no-merges
  git diff main...$branch --name-only
  git diff main...$branch -- '*.ts' '*.tsx'
done
```

Focus on:
- Only files modified in shipped branches (not entire codebase)
- Reduces token usage and execution time
- More targeted, relevant findings

**Layer 2: Related File Analysis** (Secondary)
- Imports/Dependencies of modified files
- Tests covering modified code
- Related spec files and documentation

**Layer 3: Pattern Analysis** (Tertiary)
- Duplicate code across shipped branches
- Inconsistent implementations
- Missing test coverage
- Outdated documentation

**File Patterns**:
- Code: `app/**/*.{ts,tsx}`, `lib/**/*.ts`, `components/**/*.tsx`
- Tests: `tests/e2e/**/*.spec.ts`, `tests/unit/**/*.test.ts`
- Docs: `specs/*/spec.md`, `CLAUDE.md`, `README.md`

**Rationale**:
- Git diff provides precise scope of changes
- Efficient (avoids analyzing entire codebase)
- Follows existing workflow patterns

**Alternatives Rejected**:
- Full codebase analysis: Massive token usage, very slow (>2 hours)
- Manual file list: Brittle, requires maintenance

### Decision: Safety Constraints

**Four-Layer Safety Strategy**:

**1. Test-First Validation** (Mandatory)
```bash
# After each cleanup fix
bun run test:unit -- tests/affected-area/*.test.ts

# If tests fail, revert
if [ $? -ne 0 ]; then
  git checkout -- modified-files.ts
fi
```

**2. Git Branch Isolation** (Required)
```bash
# Create cleanup branch (never commit to main)
CLEANUP_BRANCH="cleanup-$(date +%Y%m%d)"
git checkout -b "$CLEANUP_BRANCH"
```

**3. PR for Review** (vs. Auto-Merge)
```bash
gh pr create \
  --title "Automated Cleanup - $(date +%Y-%m-%d)" \
  --body "Safety Validation: All tests pass, no behavior changes" \
  --base main \
  --head "$CLEANUP_BRANCH"
```

**4. Claude Instructions** (No Behavior Modifications)
```markdown
## Critical Safety Rules
- ❌ NO behavior changes to application logic
- ❌ NO modifications to API contracts
- ❌ NO changes that break existing tests
- ✅ Refactoring only (structure, not behavior)
- ✅ All tests must pass before committing
```

**Rationale**:
- Multiple safety layers prevent breaking changes
- Test-driven ensures regressions caught immediately
- PR review provides human oversight
- Branch isolation allows easy rollback

**Alternatives Rejected**:
- Direct main commits: Too risky for automated changes
- Auto-merge PRs: Need human review of automated fixes
- Skip test validation: Could introduce regressions

### Decision: Workflow Structure

**Approach**: Hybrid of `quick-impl.yml` + `verify.yml`

**Key Parameters**:
- **Timeout**: 45 minutes (between quick-impl 30min and speckit 120min)
- **Services**: PostgreSQL + Playwright (for test validation)
- **Checkout**: `main` branch (analyze from current state)
- **Branch**: Create `cleanup-YYYYMMDD`
- **PR**: Create for manual review (no auto-merge)
- **Transition**: BUILD → VERIFY (after tests pass)

**Workflow Steps**:
1. Checkout main branch (full history for git diff)
2. Setup test environment (DB, Playwright)
3. Prepare cleanup payload (JSON with shipped branches)
4. Execute `/cleanup` command via Claude CLI
5. Run full test validation (unit + E2E)
6. Create PR for review
7. Transition ticket to VERIFY
8. Update job status

**Rationale**:
- Similar to quick-impl (fast-track pattern, shorter execution)
- Includes full test validation (from verify.yml)
- PR creation for safety (human review required)
- Follows existing workflow patterns

**Alternatives Rejected**:
- 120-minute timeout: Cleanup should be faster than full implementation
- Auto-merge: Too risky without human review
- No test validation: Could introduce regressions

---

## Implementation Summary

### Schema Changes

```prisma
// Add to Project model
model Project {
  // ... existing fields ...
  activeCleanupJobId Int? // Nullable FK to Job
  // ... existing fields ...
}

// Add to WorkflowType enum
enum WorkflowType {
  FULL
  QUICK
  CLEAN  // NEW
}
```

### Files to Create

1. `/lib/db/shipped-branches.ts` - Branch query utilities
2. `/lib/transition-lock.ts` - Lock management utilities
3. `/app/api/projects/[projectId]/clean/route.ts` - Cleanup trigger API
4. `/components/cleanup/CleanupInProgressBanner.tsx` - UI indicator
5. `/.claude/commands/cleanup.md` - Claude cleanup command
6. `/.github/workflows/cleanup.yml` - GitHub workflow
7. `/tests/unit/transition-lock.test.ts` - Unit tests
8. `/tests/integration/cleanup-workflow.spec.ts` - Integration tests
9. `/tests/e2e/cleanup-feature.spec.ts` - E2E tests

### Files to Modify

1. `/prisma/schema.prisma` - Add activeCleanupJobId and CLEAN enum
2. `/app/api/projects/[projectId]/tickets/[id]/transition/route.ts` - Add lock check
3. `/app/api/jobs/[id]/status/route.ts` - Add lock release on terminal state
4. `/components/board/board.tsx` - Add cleanup banner and drag-drop check
5. `/CLAUDE.md` - Document cleanup workflow

### Migration Command

```bash
npx prisma migrate dev --name add_cleanup_workflow
```

---

## Performance Considerations

- **Lock check overhead**: Single indexed query (O(1) lookup)
- **Branch query**: Uses indexed fields (`projectId`, `stage`, `updatedAt`)
- **Cleanup execution**: 45 minutes max (timeout)
- **Test validation**: Full suite (<5 minutes for typical project)

## Security Considerations

- **Authorization**: Use `verifyProjectAccess()` helper
- **Input validation**: Zod schema for cleanup API
- **Workflow auth**: WORKFLOW_API_TOKEN pattern
- **Rate limiting**: Consider max 1 cleanup per hour per project

## Edge Cases

1. **No shipped tickets**: Create ticket with "No branches to clean" message
2. **Cleanup fails mid-execution**: Ticket stays in BUILD, lock eventually cleared
3. **Concurrent cleanup**: First succeeds, second returns 409 Conflict
4. **Workflow crash**: Lazy cleanup releases lock on next transition
5. **Branch doesn't exist**: Workflow handles gracefully, skips branch

---

## Success Metrics

- ✅ Lock prevents transitions during cleanup
- ✅ Users can update ticket content during cleanup
- ✅ Cleanup completes in <45 minutes
- ✅ All tests pass (100% success rate)
- ✅ PR created with relevant, safe fixes
- ✅ No regressions introduced
- ✅ Lock automatically released on completion

---

**Research Complete**: All clarifications resolved. Ready for Phase 1 (Design).
