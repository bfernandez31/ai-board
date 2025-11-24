# Research Notes: Fix Rollback to Plan from Verify

## Phase 0 Research Summary

### Research Area 1: Git Reset Strategy for Workflow Context

**Decision**: Use `git reset --hard` with stash/restore pattern for spec files

**Rationale**:
- Git reset must execute in GitHub Actions (not API), matching existing workflow-based git operations
- Hard reset is required to completely remove implementation commits
- Stash/restore pattern preserves spec modifications made during BUILD/VERIFY phases

**Alternatives Considered**:
1. **Git revert**: Rejected - creates additional commits, doesn't truly "undo" implementation
2. **Git cherry-pick**: Rejected - complex to identify which commits to pick
3. **Soft reset + selective add**: Rejected - more error-prone, doesn't cleanly remove files

### Research Area 2: Commit Identification Strategy

**Decision**: Use job timestamps to identify the BUILD phase start commit

**Rationale**:
- Job table tracks when each phase began (`startedAt` timestamp)
- The commit immediately before the 'implement' job started represents the PLAN-phase state
- Can be identified using `git log --before` with the implement job's startedAt time

**Implementation Pattern**:
```bash
# Find commits before BUILD started
IMPLEMENT_JOB_TIME=$(curl API for implement job startedAt)
RESET_COMMIT=$(git log --before="$IMPLEMENT_JOB_TIME" --format="%H" -1)
git reset --hard $RESET_COMMIT
```

**Fallback**: If job timestamps are unreliable, use git log to find commits with "plan" or "tasks" in message (from speckit.yml patterns).

### Research Area 3: Spec File Preservation Pattern

**Decision**: Use git stash before reset, then restore

**Rationale**:
- Spec folder location: `specs/[BRANCH_NAME]/` (NOT `.specify/`)
- Files include: spec.md, plan.md, tasks.md, research.md, contracts/, checklists/
- Stash pattern is standard git workflow, handles all file types including nested directories

**Implementation Pattern**:
```bash
# Backup current spec folder
SPEC_DIR="specs/${BRANCH_NAME}"
git stash push --include-untracked -- "$SPEC_DIR"

# Perform reset
git reset --hard $RESET_COMMIT

# Restore spec folder
git stash pop
```

### Research Area 4: Existing Workflow Dispatch Patterns

**Decision**: Follow existing dispatch patterns from transition.ts

**Key Findings from Codebase Analysis**:

1. **All workflows dispatch on ai-board repo** (not target repo)
   - Workflows clone target repo via `githubRepository` input
   - Dispatch always uses `ref: 'main'`

2. **Standard workflow inputs format**:
   ```typescript
   workflowInputs = {
     ticket_id: ticket.ticketKey,     // "ABC-123"
     job_id: job.id.toString(),
     project_id: ticket.projectId.toString(),
     branch: ticket.branch,
     githubRepository: `${owner}/${repo}`,
   };
   ```

3. **Job creation before dispatch**:
   ```typescript
   const job = await prisma.job.create({
     data: {
       ticketId: ticket.id,
       projectId: ticket.projectId,
       command: 'rollback-reset',  // NEW command type
       status: JobStatus.PENDING,
       startedAt: new Date(),
     },
   });
   ```

4. **Workflow callback pattern**:
   ```bash
   curl -X PATCH "${APP_URL}/api/jobs/${JOB_ID}/status" \
     -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
     -d '{"status": "RUNNING"}'
   ```

### Research Area 5: Error Recovery Pattern

**Decision**: Fail-safe approach - if reset fails, branch remains in original state

**Rationale**:
- Ticket stage has already moved to PLAN (in API transaction before workflow dispatch)
- If git reset fails, user sees FAILED job and can manually investigate
- No partial resets allowed - atomic success or complete failure

**Error Scenarios**:
1. **Branch doesn't exist remotely**: Fail with clear error message
2. **Stash operation fails**: Abort reset, preserve original state
3. **Push fails**: Retry once, then fail with error message
4. **Invalid commit reference**: Use fallback commit identification

## Technical Context Resolution

All NEEDS CLARIFICATION items from Technical Context are now resolved:

| Item | Resolution |
|------|------------|
| Git reset method | `git reset --hard` with stash/restore |
| Commit identification | Job timestamp-based with fallback to commit message patterns |
| Spec preservation | `specs/[BRANCH_NAME]/` folder via git stash |
| Workflow dispatch | New `rollback-reset.yml` following existing patterns |
| Error handling | Fail-safe with job status FAILED on error |

## Dependencies

- **GitHub Actions**: Existing workflow infrastructure
- **Octokit**: For workflow dispatch (already used in transition.ts)
- **Git CLI**: For reset operations (available in GitHub Actions runners)
- **Prisma Job model**: Extended with 'rollback-reset' command type
