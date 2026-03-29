# Quickstart: Health Dashboard - Workflow health-scan.yml

**Branch**: `AIB-372-health-dashboard-workflow` | **Date**: 2026-03-29

## Implementation Order

### Step 1: Add Workflow Token Auth to Ticket Creation Endpoint

**File**: `app/api/projects/[projectId]/tickets/route.ts`

Add an alternative authentication path that accepts `WORKFLOW_API_TOKEN` Bearer tokens, similar to how the scan status endpoint authenticates. When authenticated via workflow token, skip subscription limit checks.

**Key changes**:
- Import `validateWorkflowAuth` from `@/app/lib/workflow-auth`
- At the top of the POST handler, try workflow auth first; if valid, skip `verifyProjectAccess` and subscription checks
- The workflow auth path still validates `projectId` exists but doesn't require a user session
- Return the same response format as the user-authenticated path

**Test**: Add integration test for workflow-authenticated ticket creation.

### Step 2: Create health-scan.yml Workflow

**File**: `.github/workflows/health-scan.yml`

Follow the speckit.yml pattern with these adaptations:

```yaml
name: Health Scan Workflow

on:
  workflow_dispatch:
    inputs:
      scan_id:
        description: 'HealthScan record ID'
        required: true
        type: string
      project_id:
        description: 'Project ID'
        required: true
        type: string
      scan_type:
        description: 'Scan type'
        required: true
        type: choice
        options:
          - SECURITY
          - COMPLIANCE
          - TESTS
          - SPEC_SYNC
      base_commit:
        description: 'Previous scan head commit (empty = full scan)'
        required: false
        type: string
        default: ''
      head_commit:
        description: 'Target commit (empty = use HEAD)'
        required: false
        type: string
        default: ''
      githubRepository:
        description: 'Target repo (owner/repo format)'
        required: true
        type: string
      agent:
        description: 'Agent CLI (CLAUDE or CODEX)'
        required: false
        type: string
        default: 'CLAUDE'
```

### Step 3: Implement Workflow Job Steps

**Key steps** (in order):

1. **Update status to RUNNING** — curl PATCH to scan status endpoint
2. **Sparse checkout ai-board** — `.claude-plugin` + `.github/scripts`
3. **Full checkout target repo** — `fetch-depth: 0`, branch: `main`
4. **Symlink commands** — `target/.claude/commands → ai-board/.claude-plugin/commands`
5. **Setup Bun + Node.js** — same versions as speckit.yml
6. **Configure Git** — `ai-board[bot]` user
7. **Capture HEAD SHA** — `git -C target rev-parse HEAD`
8. **Validate base_commit** — check exists, fallback to empty if not
9. **Map scan_type to command** — SECURITY → health-security, etc.
10. **Execute scan command** — `run-agent.sh $AGENT $COMMAND "$ARGS"`, capture stdout to file
11. **Parse report** — validate JSON with jq, extract score/issues
12. **Create tickets** — iterate groups, POST to ticket API for each
13. **Update report with ticket keys** — add `generatedTickets` to report JSON
14. **Update status to COMPLETED** — PATCH with score, report, telemetry
15. **Error handler** — on failure, PATCH status to FAILED with error message

### Step 4: Implement Ticket Grouping Logic

**In workflow bash**:

For SECURITY scans:
```bash
# Group issues by severity
for severity in high medium low; do
  issues=$(echo "$REPORT" | jq -r ".issues | map(select(.severity == \"$severity\"))")
  count=$(echo "$issues" | jq 'length')
  if [ "$count" -gt 0 ]; then
    # Create ticket with grouped issues
  fi
done
```

Similar patterns for COMPLIANCE (group by category), TESTS (one per nonFixable), SPEC_SYNC (one per drifted).

### Step 5: Add Integration Tests

**Files**:
- `tests/integration/health/ticket-generation.test.ts` — Test workflow-authenticated ticket creation from scan results
- Extend `tests/integration/health/scan-status.test.ts` — Verify telemetry fields are stored correctly

## Critical Implementation Notes

1. **No new Prisma schema changes** — all models already exist
2. **No new npm dependencies** — workflow uses existing tools (curl, jq, run-agent.sh)
3. **Health scan commands are OUT OF SCOPE** — the workflow expects them to exist but this ticket only creates the orchestration
4. **Ticket creation auth** — the one code change needed is adding workflow auth to the ticket endpoint
5. **Report JSON handling** — use `jq` in bash for all JSON manipulation; avoid complex bash string parsing
6. **Error isolation** — ticket creation failures must not prevent scan completion
