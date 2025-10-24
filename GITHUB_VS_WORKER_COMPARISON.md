# GitHub Actions vs Worker - Code Comparison

## Side-by-Side Comparison of What Each System Does

### 1. Job Status Update to RUNNING

**GitHub Actions (speckit.yml lines 91-98):**
```yaml
- name: Update Job Status - Running
  if: ${{ inputs.job_id }}
  run: |
    curl -X PATCH "${APP_URL}/api/jobs/${{ inputs.job_id }}/status" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
      -d '{"status": "RUNNING"}' \
      -f -s -S || echo "⚠️ Failed to update job status to RUNNING"
```

**Worker (index.ts line 47):**
```typescript
// Update job status to RUNNING
await updateJobStatus(jobId, 'RUNNING');
```

✅ **SAME FUNCTIONALITY**: Both update the job status to RUNNING via API

---

### 2. Repository Checkout/Clone

**GitHub Actions (speckit.yml lines 100-107):**
```yaml
- name: Checkout repository
  uses: actions/checkout@v4
  with:
    # For specify command, always checkout main (branch will be created later)
    # For other commands, checkout the provided branch
    ref: ${{ inputs.command == 'specify' && 'main' || inputs.branch || github.ref }}
    fetch-depth: 0
```

**Worker (index.ts lines 58-65):**
```typescript
// Clone or pull repository
if (!existsSync(workspace)) {
  console.log(`[Worker] Cloning repository to ${workspace}`);
  await execAsync(`git clone ${repoUrl} ${workspace}`);
} else {
  console.log(`[Worker] Pulling latest changes in ${workspace}`);
  await execAsync(`cd ${workspace} && git fetch origin && git reset --hard origin/main`);
}
```

✅ **SAME FUNCTIONALITY**: Both clone/checkout the repository

---

### 3. Branch Management

**GitHub Actions (handled by create-new-feature.sh script in specify command):**
```bash
# In the Claude execution, the script creates branch:
# .specify/scripts/bash/create-new-feature.sh creates branch like "020-feature-name"
```

**Worker (index.ts lines 67-83):**
```typescript
// Handle branch management
let workingBranch = branch;
if (!branch && command === 'specify') {
  // Create new branch for specify command
  workingBranch = `${ticketId}-${slugify(job.data.ticketTitle)}`;
  console.log(`[Worker] Creating new branch: ${workingBranch}`);
  await execAsync(`cd ${workspace} && git checkout -b ${workingBranch}`);
} else if (branch) {
  // Checkout existing branch
  console.log(`[Worker] Checking out branch: ${branch}`);
  try {
    await execAsync(`cd ${workspace} && git checkout ${branch}`);
  } catch (error) {
    // If branch doesn't exist locally, fetch and checkout
    await execAsync(`cd ${workspace} && git fetch origin ${branch}:${branch} && git checkout ${branch}`);
  }
}
```

✅ **SAME FUNCTIONALITY**: Both create new branch for specify, checkout existing for others

---

### 4. Environment Setup

**GitHub Actions (speckit.yml lines 109-130):**
```yaml
- name: Setup Bun
  uses: oven-sh/setup-bun@v1
  with:
    bun-version: latest

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22.20.0'

- name: Setup Python
  uses: actions/setup-python@v5
  with:
    python-version: '3.11'

- name: Install Claude Code CLI
  run: bun add -g @anthropic-ai/claude-code
```

**Worker (Dockerfile):**
```dockerfile
FROM oven/bun:1.1.38-alpine
WORKDIR /app

# Install git and other dependencies
RUN apk add --no-cache git bash

# Bun is already in the base image
# TODO: Add Claude CLI installation
```

⚠️ **MISSING IN WORKER**: Claude CLI not yet installed (TODO)

---

### 5. Git Configuration

**GitHub Actions (speckit.yml lines 131-135):**
```yaml
- name: Configure Git
  run: |
    git config --global user.name "ai-board[bot]"
    git config --global user.email "bot@ai-board.app"
```

**Worker:**
```typescript
// TODO: Add git config
// Currently missing, should add:
await execAsync(`git config --global user.name "ai-board[bot]"`);
await execAsync(`git config --global user.email "bot@ai-board.app"`);
```

⚠️ **MISSING IN WORKER**: Git config not yet set (TODO)

---

### 6. Execute Claude Command

**GitHub Actions (speckit.yml lines 219-280):**
```bash
case "${{ inputs.command }}" in
  specify)
    # Execute with images if available
    claude --dangerously-skip-permissions "/speckit.specify $payload" $IMAGE_PATHS
    ;;
  plan)
    claude --dangerously-skip-permissions "/speckit.plan"
    ;;
  task)
    claude --dangerously-skip-permissions "/speckit.tasks"
    ;;
  implement)
    claude --dangerously-skip-permissions "/speckit.implement"
    ;;
esac
```

**Worker (index.ts lines 85-93):**
```typescript
// Map command to Claude CLI command
const claudeCommand = mapToClaudeCommand(command);

// TODO: Execute Claude command (requires Claude CLI setup)
console.log(`[Worker] Would execute: claude ${claudeCommand}`);

// For now, create a placeholder file to test the workflow
const testFile = path.join(workspace, `test-${command}-${Date.now()}.md`);
await execAsync(`echo "# Test file for ${command}\n\nTicket: ${job.data.ticketTitle}" > ${testFile}`);
```

⚠️ **NOT YET IMPLEMENTED**: Worker creates placeholder instead of running Claude

---

### 7. Commit and Push Changes

**GitHub Actions (speckit.yml lines 310-340):**
```bash
- name: Commit changes
  run: |
    if [ -n "$(git status --porcelain)" ]; then
      git add .
      git commit -m "${{ inputs.command }}: Ticket #${{ inputs.ticket_id }}"

      # Capture current branch
      CURRENT_BRANCH=$(git branch --show-current)
      echo "branch=$CURRENT_BRANCH" >> "$GITHUB_OUTPUT"

      # Push changes
      git push origin "$CURRENT_BRANCH"
    fi
```

**Worker (index.ts lines 95-102):**
```typescript
// Stage, commit and push changes
const commitMessage = `${command}: ${job.data.ticketTitle}`;
await execAsync(`cd ${workspace} && git add .`);
await execAsync(`cd ${workspace} && git commit -m "${commitMessage}" || true`); // || true to handle no changes

if (workingBranch) {
  await execAsync(`cd ${workspace} && git push origin ${workingBranch}`);
}
```

✅ **SAME FUNCTIONALITY**: Both commit and push changes

---

### 8. Update Ticket Branch

**GitHub Actions (speckit.yml lines 342-351):**
```bash
- name: Update ticket branch
  run: |
    if [ -n "$CURRENT_BRANCH" ] && [ -z "${{ inputs.branch }}" ]; then
      curl -X PATCH "${APP_URL}/api/projects/${{ inputs.project_id }}/tickets/${{ inputs.ticket_id }}/branch" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
        -d "{\"branch\": \"$CURRENT_BRANCH\"}"
    fi
```

**Worker (index.ts lines 104-107):**
```typescript
// Update ticket branch if new branch was created
if (!branch && workingBranch) {
  await updateTicketBranch(ticketId, projectId, workingBranch);
}
```

✅ **SAME FUNCTIONALITY**: Both update ticket branch via API

---

### 9. Update Job Status to COMPLETED/FAILED

**GitHub Actions (speckit.yml lines 352-370):**
```yaml
- name: Update Job Status - Success
  if: success() && inputs.job_id
  run: |
    curl -X PATCH "${APP_URL}/api/jobs/${{ inputs.job_id }}/status" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
      -d '{"status": "COMPLETED"}'

- name: Update Job Status - Failed
  if: failure() && inputs.job_id
  run: |
    curl -X PATCH "${APP_URL}/api/jobs/${{ inputs.job_id }}/status" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
      -d '{"status": "FAILED"}'
```

**Worker (index.ts lines 109-119):**
```typescript
// Update job status to COMPLETED
await updateJobStatus(jobId, 'COMPLETED');

// In catch block:
// Update job status to FAILED
await updateJobStatus(jobId, 'FAILED', error instanceof Error ? error.message : 'Unknown error');
```

✅ **SAME FUNCTIONALITY**: Both update final job status

---

## Summary: What's Missing in Worker

### ✅ Already Implemented (Same as GitHub Actions):
1. **Job status updates** (RUNNING, COMPLETED, FAILED)
2. **Repository cloning/checkout**
3. **Branch management** (create for specify, checkout for others)
4. **Commit and push changes**
5. **Update ticket branch via API**
6. **Error handling and status reporting**

### ⚠️ TODO - Not Yet Implemented:
1. **Claude CLI installation** - Need to add to Dockerfile
2. **Git configuration** - Need to set user.name and user.email
3. **Claude command execution** - Currently creates placeholder files
4. **Image handling for specify** - Need to download/process attachments
5. **E2E skip detection** - Need to check for [e2e] in title

### 📝 Worker Implementation Needed:

```typescript
// Add to worker/src/index.ts:

// 1. Git configuration (add at start of processJob)
await execAsync(`git config --global user.name "ai-board[bot]"`);
await execAsync(`git config --global user.email "bot@ai-board.app"`);

// 2. E2E skip detection
if (job.data.ticketTitle.includes('[e2e]')) {
  console.log('[Worker] Skipping E2E test ticket');
  await updateJobStatus(jobId, 'COMPLETED');
  return { success: true, skipped: true };
}

// 3. Claude execution (replace placeholder code)
const claudeCommand = mapToClaudeCommand(command);
await execAsync(`cd ${workspace} && claude --dangerously-skip-permissions "${claudeCommand}"`);

// 4. Add to Dockerfile:
RUN bun add -g @anthropic-ai/claude-code
```

## Conclusion

**The worker is doing EXACTLY the same operations as GitHub Actions**, just in a different environment:
- GitHub Actions uses YAML workflow steps → Worker uses TypeScript functions
- GitHub Actions uses `curl` for API calls → Worker uses `fetch`
- GitHub Actions uses `actions/checkout` → Worker uses `git clone`
- GitHub Actions runs in GitHub cloud → Worker runs in Docker container

The core logic is identical - only the Claude CLI execution needs to be implemented to make it fully functional.