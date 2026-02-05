# External Integrations

GitHub Actions, Cloudinary CDN, and Vercel deployment integrations.

## GitHub Actions Integration

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant API as Next.js API
    participant DB as Prisma/PostgreSQL
    participant GH as GitHub Actions
    participant CLI as Claude CLI
    participant Ext as External Repo

    Note over UI,Ext: Workflow Dispatch Pattern

    UI->>API: POST /api/transition
    API->>DB: Create Job (PENDING)
    API->>GH: octokit.createWorkflowDispatch()
    API-->>UI: 200 OK

    GH->>GH: Checkout ai-board repo
    GH->>Ext: Clone external repo (GH_PAT)
    GH->>CLI: Execute Claude command

    CLI->>CLI: Read specs, write code
    CLI->>Ext: Commit changes

    GH->>API: PATCH /api/jobs/:id (RUNNING)
    Note over GH,API: WORKFLOW_API_TOKEN auth

    GH->>GH: Complete workflow
    GH->>API: PATCH /api/jobs/:id (COMPLETED)

    loop Polling (2s interval)
        UI->>API: GET /api/jobs/status
        API->>DB: Query job
        API-->>UI: Job status
    end
```

### Octokit Client

**Package**: `@octokit/rest` ^22.0.0

**Setup** (`app/lib/workflows/dispatch.ts`):

```typescript
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function dispatchWorkflow(params: {
  owner: string;
  repo: string;
  workflowFile: string;
  inputs: Record<string, string>;
}) {
  try {
    await octokit.rest.actions.createWorkflowDispatch({
      owner: params.owner,
      repo: params.repo,
      workflow_id: params.workflowFile,
      ref: 'main',
      inputs: params.inputs,
    });

    console.log(`Workflow dispatched: ${params.workflowFile}`);
    return { success: true };
  } catch (error) {
    console.error('Workflow dispatch failed:', error);
    throw error;
  }
}
```

### Workflow Files

**Main Workflow** (`.github/workflows/speckit.yml`):
- **Trigger**: `workflow_dispatch` (manual dispatch only)
- **Inputs**:
  - `ticket_id`, `ticketTitle`, `ticketDescription`, `branch`, `command`, `job_id`, `project_id`
  - `githubOwner`, `githubRepo` (required) - Target repository for checkout
- **Repository Checkout**: Checks out external project repository using `repository: ${{ inputs.githubOwner }}/${{ inputs.githubRepo }}`
- **Environment**: ubuntu-latest, Node.js 22.20.0, Python 3.11, PostgreSQL 14
- **Commands**: specify, plan, task, implement, clarify
- **Services**: PostgreSQL for implement command
- **Dependencies**: Playwright with browser binaries (cached)
- **Timeout**: 120 minutes maximum

**Quick-Impl Workflow** (`.github/workflows/quick-impl.yml`):
- **Trigger**: `workflow_dispatch`
- **Inputs**:
  - `ticket_id`, `ticketTitle`, `ticketDescription`, `job_id`, `project_id`
  - `githubOwner`, `githubRepo` (required) - Target repository for checkout
- **Repository Checkout**: Checks out external project repository
- **Differences**: Skips full spec generation, executes `/ai-board.quick-impl` command
- **Same**: Environment setup, branch management, job status updates

**Verify Workflow** (`.github/workflows/verify.yml`):
- **Trigger**: `workflow_dispatch`
- **Inputs**:
  - `ticket_id`, `job_id`, `project_id`, `branch`, `workflowType`
  - `githubOwner`, `githubRepo` (required) - Target repository for checkout
- **Repository Checkout**: Checks out external project repository at specified branch
- **Actions**: Runs tests and creates pull request
- **Test Execution**: Conditional based on workflowType (FULL or QUICK)

**AI-BOARD Assist** (`.github/workflows/ai-board-assist.yml`):
- **Trigger**: `workflow_dispatch`
- **Inputs**:
  - `ticket_id`, `stage`, `comment_content`, `job_id`, `project_id`
  - `githubRepository` (required) - Target repository in format owner/repo
- **Repository Checkout**: Checks out external project repository
- **Telemetry Pre-Fetch**: Executes `fetch-telemetry.sh` for `/compare` commands
- **Command**: Claude updates spec/plan based on comment request
- **Response**: Posts summary comment via API

**Deploy Preview** (`.github/workflows/deploy-preview.yml`):
- **Trigger**: `workflow_dispatch`
- **Inputs**:
  - `ticket_id`, `project_id`, `branch`, `job_id`
  - `githubOwner`, `githubRepo` (required) - Target repository for checkout
- **Repository Checkout**: Checks out external project repository at specified branch
- **Action**: Deploy feature branch to Vercel preview environment
- **Output**: Preview URL stored in ticket.previewUrl field
- **Method**: Vercel CLI deployment with project/org scoping

**Cleanup Workflow** (`.github/workflows/cleanup.yml`):
- **Trigger**: `workflow_dispatch`
- **Inputs**:
  - `ticket_id`, `project_id`, `job_id`
  - `githubRepository` (required) - Target repository in format owner/repo
- **Repository Checkout**: Checks out external project repository at main branch with full history (`fetch-depth: 0`)
- **Environment**: ubuntu-latest, Node.js 22.20.0, Python 3.11, Bun 1.3.1, PostgreSQL 14
- **Services**: PostgreSQL for test execution
- **Dependencies**: Playwright with chromium browser
- **Command**: Executes `/cleanup` Claude command
- **Actions**: Diff-based technical debt analysis, creates cleanup branch, transitions to VERIFY
- **Timeout**: 45 minutes maximum

**Auto-Ship** (`.github/workflows/auto-ship.yml`):
- **Trigger**: `deployment_status` event
- **Conditions**: Vercel production deployment success
- **Action**: Transitions VERIFY → SHIP for tickets with merged branches
- **Method**: Git ancestry check (`git merge-base --is-ancestor`)

### Claude Commands

**Implementation Command** (`commands/ai-board.implement.md`):
- **Purpose**: Execute all tasks in tasks.md and generate implementation summary
- **Input**: Tasks from tasks.md, plan from plan.md, spec from spec.md
- **Steps**:
  1. Prerequisites check (validate FEATURE_DIR and required files)
  2. Checklist validation (optional, blocks if incomplete)
  3. Load implementation context (tasks, plan, data model, contracts)
  4. Setup verification (create/verify ignore files)
  5. Parse task structure (phases, dependencies, execution order)
  6. Execute implementation (phase-by-phase, respecting dependencies)
  7. Progress tracking (mark completed tasks with [X])
  8. Completion validation (verify all tasks completed)
  9. Summary generation (Step 10)
- **Output**: Implemented code, marked tasks, summary.md file

**Summary Generation (Step 10)**:
- Reads summary template from `.claude-plugin/templates/summary-template.md` (via ai-board checkout)
- Generates content following template structure exactly
- Extracts feature name from spec.md header (first `#` line)
- Gets current git branch (`git branch --show-current`)
- Uses current date in YYYY-MM-DD format
- Enforces character limits:
  - Changes Summary: max 500 chars
  - Key Decisions: max 500 chars
  - Files Modified: max 500 chars
  - Manual Requirements: max 300 chars
  - Total: max 2300 chars
- Writes to `FEATURE_DIR/summary.md`
- Handles partial failures: includes progress and failure point

**Summary Template** (`.claude-plugin/templates/summary-template.md`):

```markdown
# Implementation Summary: [FEATURE_NAME]

**Branch**: `[BRANCH]` | **Date**: [DATE]
**Spec**: [link to spec.md]

## Changes Summary

[Brief description of what was implemented - max 500 chars]

## Key Decisions

[Important technical decisions made during implementation - max 500 chars]

## Files Modified

[List of key files created/modified - max 500 chars]

## ⚠️ Manual Requirements

[Any steps requiring human action, or "None" if fully automated - max 300 chars]
```

**Template Pattern**:
- Follows existing template conventions (spec-template.md, plan-template.md)
- Located in `.claude-plugin/templates/` directory (ai-board plugin)
- Placeholder format: `[PLACEHOLDER_NAME]`
- Section headers with Markdown H2 (`##`)
- Warning emoji (`⚠️`) for manual requirements section

**Code Simplifier Command** (`commands/ai-board.code-simplifier.md`):
- **Purpose**: Simplify and refine code for clarity, consistency, and maintainability
- **Trigger**: Verify workflow (Phase 4.5, after test fixes)
- **Scope**: Recently modified code (git diff main...HEAD)
- **Actions**:
  - Preserve functionality - only improve code structure
  - Apply project coding standards from CLAUDE.md
  - Reduce unnecessary complexity and nesting
  - Eliminate redundant code and abstractions
  - Avoid nested ternary operators
- **Output**: Refined code committed to feature branch

**Code Review Command** (`commands/ai-board.code-review.md`):
- **Purpose**: Automated code review for pull requests
- **Trigger**: Verify workflow (Phase 7, after PR creation)
- **Input**: PR number
- **Review Checks**:
  - CLAUDE.md compliance
  - Constitution compliance (`.ai-board/memory/constitution.md`)
  - Obvious bugs in changed code
  - Historical git context issues
  - Code comment guidance adherence
- **Confidence Scoring**: Issues scored 0-100, only 80+ reported
- **Output**: Review findings posted as PR comment via `gh` CLI

### Authentication

**GitHub Token** (Automatic):
- Provided by GitHub Actions (`GITHUB_TOKEN` secret)
- Permissions: Read repository, create workflow dispatches
- Scope: Current repository only (ai-board)
- Used for dispatching workflows in ai-board repository

**GitHub Personal Access Token** (Custom):
- Stored as `GH_PAT` repository secret
- **Purpose**: Access external project repositories from workflows
- **Required Scope**: `repo` (full control of private repositories)
- **Usage**: Checkout external repositories in workflow steps
- **Security**: Centralized in ai-board, shared across all external projects

**Workflow API Token** (Custom):
- Stored as `WORKFLOW_API_TOKEN` repository secret
- Used for API authentication from workflows back to ai-board API
- Bearer token format: `Authorization: Bearer <token>`
- Validated via constant-time comparison

### API Communication Pattern

**Dispatch from API** → **Execute in Workflow** → **Status Update to API**

```typescript
// 1. API dispatches workflow
await octokit.rest.actions.createWorkflowDispatch({ ... });

// 2. Workflow executes command
// (in GitHub Actions runner)

// 3. Workflow updates job status
await fetch(`${APP_URL}/api/jobs/${job_id}/status`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${WORKFLOW_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ status: 'COMPLETED' }),
});
```

### Environment Variables

**GitHub Secrets**:
- `ANTHROPIC_API_KEY`: Claude API key
- `WORKFLOW_API_TOKEN`: Workflow authentication token
- `GH_PAT`: GitHub Personal Access Token with `repo` scope (for external repository access)
- `VERCEL_TOKEN`: Vercel API token (for deploy-preview workflow)
- `VERCEL_ORG_ID`: Vercel organization/team ID
- `VERCEL_PROJECT_ID`: Vercel project ID
- `GITHUB_TOKEN`: Automatic (provided by GitHub, ai-board repository only)

**Repository Variables**:
- `APP_URL`: Application URL for API calls (e.g., `https://ai-board.vercel.app`)

### Telemetry Context Script

**Script**: `.github/scripts/fetch-telemetry.sh`

**Purpose**: Pre-fetch job telemetry for tickets referenced in `/compare` commands.

**Execution Context**:
- Called by `ai-board-assist.yml` workflow before Claude execution
- Conditional: Only runs when comment contains `/compare`
- Runs after repository checkout, before Claude CLI execution

**Process**:
1. Parses ticket references from comment using regex: `#[A-Z0-9]{3,6}-[0-9]+`
2. Resolves each ticket key to ticket ID via search API
3. Fetches jobs for each ticket via jobs API (requires workflow token)
4. Aggregates telemetry from COMPLETED jobs:
   - Sums token counts (input, output, cache read, cache creation)
   - Sums cost (USD) and duration (milliseconds)
   - Extracts first model name from completed jobs
   - Collects unique tool names across all jobs
   - Counts completed jobs per ticket
5. Writes aggregated data to `.telemetry-context.json` in ticket's spec directory

**Output File Structure**:
```json
{
  "generatedAt": "2026-01-03T10:30:00Z",
  "tickets": {
    "AIB-127": {
      "ticketKey": "AIB-127",
      "inputTokens": 15000,
      "outputTokens": 5000,
      "cacheReadTokens": 3000,
      "cacheCreationTokens": 1000,
      "costUsd": 0.125,
      "durationMs": 180000,
      "model": "claude-sonnet-4-5-20250929",
      "toolsUsed": ["Edit", "Read", "Bash"],
      "jobCount": 4,
      "hasData": true
    },
    "AIB-128": {
      "ticketKey": "AIB-128",
      "inputTokens": 0,
      "outputTokens": 0,
      "cacheReadTokens": 0,
      "cacheCreationTokens": 0,
      "costUsd": 0,
      "durationMs": 0,
      "model": null,
      "toolsUsed": [],
      "jobCount": 0,
      "hasData": false
    }
  }
}
```

**Error Handling**:
- API failures: Uses empty telemetry (zeros, hasData: false)
- Missing tickets: Uses empty telemetry
- No completed jobs: Sets jobCount: 0, hasData: false
- Script continues on individual ticket failures (non-blocking)

**Environment Requirements**:
- `APP_URL`: Base URL for API endpoints
- `WORKFLOW_API_TOKEN`: Bearer token for authentication
- `PROJECT_ID`: Current project ID
- `BRANCH`: Current ticket branch (for output file path)

**Usage in Claude**:
```bash
# Claude reads context file during /compare execution
cat specs/$BRANCH/.telemetry-context.json
```

**File Lifecycle**:
- Generated: Before each `/compare` execution
- Location: `specs/{branch}/.telemetry-context.json`
- Ignored: `.gitignore` entry prevents commit
- Temporary: Regenerated on every comparison request

### Multi-Repository Workflow Architecture

**Centralized Workflow Management**:
- All GitHub Actions workflows stored in ai-board repository (`.github/workflows/`)
- Workflows dispatch from ai-board but execute against external project repositories
- External projects do not need workflow configuration (workflows-as-a-service)

**External Repository Checkout Pattern**:

```yaml
- name: Checkout repository
  uses: actions/checkout@v4
  with:
    # Checkout external project repository
    repository: ${{ inputs.githubOwner }}/${{ inputs.githubRepo }}
    ref: ${{ inputs.branch }}
    token: ${{ secrets.GH_PAT }}
    fetch-depth: 0
```

**Workflow Dispatch Pattern**:

```typescript
// API dispatches workflow with project repository information
await octokit.actions.createWorkflowDispatch({
  owner: 'ai-board-org',  // ai-board repository
  repo: 'ai-board',
  workflow_id: 'speckit.yml',
  ref: 'main',
  inputs: {
    ticket_id: '123',
    command: 'specify',
    githubOwner: 'bfernandez31',      // External project owner
    githubRepo: 'my-external-project', // External project repo
    // ... other inputs
  },
});
```

**External Project Requirements**:
- **No ai-board files required in external projects**
- Workflows use double checkout pattern (ai-board + target)
- ai-board commands symlinked to target during workflow execution
- Test configuration (if using verify workflow)
- Standard project structure compatible with ai-board commands

**Benefits**:
- Single source of truth for workflow definitions
- Easy updates and maintenance (change once, applies to all projects)
- No workflow configuration burden on external projects
- Consistent automation behavior across all managed projects

### Branch Deletion

**Function**: `deleteBranchAndPRs` (`lib/github/delete-branch-and-prs.ts`)

**Purpose**: Delete Git branches and close associated pull requests during ticket deletion.

**Sequence**:
1. Find all open PRs with matching head branch
2. Close all matching PRs (required before branch deletion)
3. Delete the Git branch

**Idempotent Operations**:
- 404 errors (branch already deleted) are acceptable
- 422 errors with "reference does not exist" message are acceptable (branch already deleted)
- Returns success even if branch was already deleted

**Usage**:
```typescript
import { Octokit } from '@octokit/rest';
import { deleteBranchAndPRs } from '@/lib/github/delete-branch-and-prs';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const result = await deleteBranchAndPRs(
  octokit,
  'bfernandez31',
  'ai-board',
  '084-drag-and-drop'
);

console.log(`Closed ${result.prsClosed} PRs, deleted branch: ${result.branchDeleted}`);
```

**Return Type**:
```typescript
interface GitHubCleanupResult {
  prsClosed: number;        // Number of PRs closed
  branchDeleted: boolean;   // False if branch was already deleted
}
```

**Error Handling**:
- 403 errors: Permission denied (check token scope includes 'repo' access)
- 422 errors (non-reference-not-found): Protected branch (remove protection in GitHub settings)
- 429 errors: Rate limit exceeded (includes reset timestamp)
- Other errors: Re-thrown with descriptive message

### Error Handling

```typescript
try {
  await dispatchWorkflow({ ... });
} catch (error: any) {
  if (error.status === 401) {
    throw new Error('GitHub authentication failed');
  } else if (error.status === 403) {
    throw new Error('Rate limit exceeded or insufficient permissions');
  } else if (error.status === 404) {
    throw new Error('Workflow file not found');
  } else {
    throw new Error(`Workflow dispatch failed: ${error.message}`);
  }
}
```

## Cloudinary CDN Integration

### SDK Setup

**Package**: `cloudinary` (Node.js SDK v2)

**Configuration** (`app/lib/cloudinary.ts`):

```typescript
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };
```

### Upload Image

```typescript
import { cloudinary } from '@/app/lib/cloudinary';

export async function uploadImage(
  buffer: Buffer,
  ticketId: number,
  filename: string
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `ai-board/tickets/${ticketId}`,
        public_id: filename,
        resource_type: 'image',
        overwrite: false,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result!);
      }
    );

    uploadStream.end(buffer);
  });
}
```

### Delete Image

```typescript
export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
    });

    console.log(`Deleted image: ${publicId}`);
  } catch (error) {
    console.error('Failed to delete image:', error);
    // Don't throw - continue with database operation
  }
}
```

### Folder Structure

```
ai-board/
└── tickets/
    ├── 1/
    │   ├── screenshot-1.png
    │   └── diagram-2.png
    ├── 2/
    │   └── mockup-3.png
    └── 42/
        └── bug-screenshot-4.png
```

### API Route Pattern

```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  // Validate file
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 });
  }

  // Convert to buffer
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Upload to Cloudinary
  const result = await uploadImage(buffer, ticketId, file.name);

  // Store metadata in database
  const attachment: TicketAttachment = {
    type: 'uploaded',
    url: result.secure_url,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
    cloudinaryPublicId: result.public_id,
  };

  // Update ticket attachments
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      attachments: {
        push: attachment,
      },
    },
  });

  return NextResponse.json({ attachment });
}
```

### Environment Variables

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abc123def456
```

### Free Tier Limits

- **Storage**: 25GB
- **Bandwidth**: 25GB/month
- **Transformations**: 25,000/month
- **Requests**: Unlimited

### Error Handling

```typescript
try {
  const result = await uploadImage(buffer, ticketId, filename);
} catch (error: any) {
  if (error.http_code === 420) {
    throw new Error('Rate limit exceeded');
  } else if (error.http_code === 500) {
    throw new Error('Cloudinary service error');
  } else {
    throw new Error(`Upload failed: ${error.message}`);
  }
}
```

## Vercel Deployment Integration

### Platform Features

**Serverless Functions**:
- API routes run as serverless functions
- 10-second execution limit (hobby plan)
- 50MB payload limit
- No persistent connections (hence polling vs WebSockets)

**Edge Network**:
- Global CDN for static assets
- Automatic HTTPS
- Brotli compression
- Image optimization

**Environment Variables**:
- Set via Vercel dashboard
- Different values for preview vs production
- Encrypted at rest

### Auto-Ship Workflow

**Trigger**: `deployment_status` event from Vercel

```yaml
name: Auto-Ship on Production Deployment

on:
  deployment_status:

jobs:
  auto-ship:
    if: |
      github.event.deployment_status.state == 'success' &&
      github.event.deployment.environment == 'Production' &&
      github.event.sender.login == 'vercel[bot]'
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Auto-ship tickets
        env:
          DEPLOYMENT_SHA: ${{ github.event.deployment.sha }}
          APP_URL: ${{ vars.APP_URL }}
          WORKFLOW_API_TOKEN: ${{ secrets.WORKFLOW_API_TOKEN }}
        run: |
          .claude-plugin/scripts/bash/auto-ship-tickets.sh \
            "${DEPLOYMENT_SHA}" \
            "${APP_URL}" \
            "${WORKFLOW_API_TOKEN}"
```

**Script Logic** (`.claude-plugin/scripts/bash/auto-ship-tickets.sh`):

1. Fetch all VERIFY stage tickets via API
2. For each ticket with branch:
   - Fetch branch from remote
   - Check if branch merged: `git merge-base --is-ancestor <branch> <deployment-sha>`
   - If merged: Transition VERIFY → SHIP via API
   - Post deployment notification comment
3. Generate summary report

### Environment Configuration

**Production**:
```env
DATABASE_URL=<postgresql-connection-string>
NEXTAUTH_URL=https://ai-board.vercel.app
NEXTAUTH_SECRET=<production-secret>
# ... other secrets
```

**Preview**:
```env
DATABASE_URL=<preview-database-connection-string>
NEXTAUTH_URL=https://ai-board-<branch>.vercel.app
NEXTAUTH_SECRET=<preview-secret>
```

### Build Configuration

**vercel.json**:

```json
{
  "buildCommand": "next build",
  "devCommand": "next dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "DATABASE_URL": "@database_url",
    "NEXTAUTH_SECRET": "@nextauth_secret"
  }
}
```

### Performance Monitoring

- **Build Time**: <5 minutes
- **Cold Start**: <200ms (API routes)
- **Response Time**: <100ms (p95)
- **Cache Hit Rate**: >80% (static assets)

## Error Handling Patterns

### Retry with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      const delay = Math.min(1000 * 2 ** attempt, 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
}

// Usage
const result = await retryWithBackoff(() =>
  octokit.rest.actions.createWorkflowDispatch({ ... })
);
```

### Graceful Degradation

```typescript
try {
  await deleteImage(publicId);
} catch (error) {
  // Log but don't throw - continue with database operation
  console.error('Cloudinary deletion failed:', error);
  // Image becomes orphaned but database stays consistent
}
```

### Circuit Breaker (Future Enhancement)

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: number;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.failures >= 5) {
      const timeSinceFailure = Date.now() - (this.lastFailureTime || 0);
      return timeSinceFailure < 60000;  // 1 minute cooldown
    }
    return false;
  }

  private onSuccess() {
    this.failures = 0;
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
  }
}
```
