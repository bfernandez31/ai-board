# MVP Quickstart - GitHub Actions Approach

## Overview

The MVP uses **GitHub Actions** as the spec-kit execution environment, eliminating the need for additional infrastructure while providing a simple, cost-effective solution.

**Key Benefits:**
- ✅ Zero infrastructure cost (GitHub Actions free tier: 2000 min/month)
- ✅ No server management required
- ✅ Repository already cloned in runner environment
- ✅ Built-in logs and monitoring via GitHub UI
- ✅ Simple deployment (Vercel + managed Postgres)

**Limitations:**
- ⚠️ Execution latency: ~20-40s (includes queue time + runner boot)
- ⚠️ Limited to GitHub Actions quotas (2000 free minutes/month)
- ⚠️ Less control over execution environment

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Browser                                 │
│  - Drag ticket to SPECIFY/PLAN/BUILD                            │
└─────────────────┬───────────────────────────────────────────────┘
                  │ HTTPS POST /api/tickets/[id]/transition
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              Next.js API Routes (Vercel)                        │
│  - Validate transition                                          │
│  - Create job record in PostgreSQL                              │
│  - Dispatch GitHub Actions workflow via Octokit                 │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ├─────────────────┬────────────────────────────┐
                  ▼                 ▼                            ▼
         ┌────────────────┐  ┌──────────────┐     ┌─────────────────┐
         │   PostgreSQL   │  │   GitHub     │     │   GitHub        │
         │   (Neon/       │  │   API        │     │   Actions       │
         │   Supabase)    │  │   (Octokit)  │     │   Runner        │
         │                │  │              │     │                 │
         │ - Tickets      │  │ - Dispatch   │     │ 1. Checkout     │
         │ - Jobs         │  │   workflow   │     │    branch       │
         │ - Projects     │  │              │     │ 2. Install deps │
         └────────────────┘  └──────────────┘     │ 3. Run spec-kit │
                  ▲                                │ 4. Commit files │
                  │                                │ 5. Push branch  │
                  │                                └────────┬────────┘
                  │                                         │
                  │ Webhook callback                        │
                  │ (job completed)                         │
                  └─────────────────────────────────────────┘
```

## Workflow Implementation

### GitHub Actions Workflow File

Create `.github/workflows/speckit.yml`:

```yaml
name: Spec-kit Automation

on:
  workflow_dispatch:
    inputs:
      ticket_id:
        description: 'Ticket ID'
        required: true
        type: string
      command:
        description: 'Spec-kit command to execute'
        required: true
        type: choice
        options:
          - specify
          - plan
          - task
          - implement
      branch:
        description: 'Feature branch name'
        required: true
        type: string

jobs:
  run-speckit:
    runs-on: ubuntu-latest
    timeout-minutes: 120  # 2h max (GitHub Actions hard limit: 6h)

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          ref: ${{ inputs.branch }}
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.20.0'

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Claude Code CLI
        run: |
          npm install -g @anthropic-ai/claude-code

      - name: Install spec-kit
        run: |
          pip install uv
          uv pip install spec-kit

      - name: Configure Git
        run: |
          git config user.name "ai-board[bot]"
          git config user.email "bot@ai-board.app"

      - name: Execute spec-kit command
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          case "${{ inputs.command }}" in
            specify)
              echo "Running /specify for ticket #${{ inputs.ticket_id }}"
              claude /specify
              ;;
            plan)
              echo "Running /plan for ticket #${{ inputs.ticket_id }}"
              claude /plan
              ;;
            task)
              echo "Running /task for ticket #${{ inputs.ticket_id }}"
              claude /task
              ;;
            implement)
              echo "Running /implement for ticket #${{ inputs.ticket_id }}"
              claude /implement
              ;;
            *)
              echo "Unknown command: ${{ inputs.command }}"
              exit 1
              ;;
          esac

      - name: Commit changes
        run: |
          git add .
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            git commit -m "feat(ticket-${{ inputs.ticket_id }}): ${{ inputs.command }} - automated spec-kit execution"
          fi

      - name: Push changes
        run: |
          git push origin ${{ inputs.branch }}

      - name: Report success
        if: success()
        run: |
          echo "✅ Spec-kit command '${{ inputs.command }}' completed successfully"
          echo "Ticket: #${{ inputs.ticket_id }}"
          echo "Branch: ${{ inputs.branch }}"

      - name: Report failure
        if: failure()
        run: |
          echo "❌ Spec-kit command '${{ inputs.command }}' failed"
          echo "Ticket: #${{ inputs.ticket_id }}"
          exit 1
```

### API Route Implementation

Create `app/api/tickets/[id]/transition/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = parseInt(params.id);
    const { targetStage } = await request.json();

    // Get ticket with project info
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { project: true },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Determine spec-kit command based on target stage
    const commandMap: Record<string, string> = {
      SPECIFY: 'specify',
      PLAN: 'plan',    // Will run /plan and /task
      BUILD: 'implement',
    };

    const command = commandMap[targetStage];

    if (!command) {
      // No spec-kit command for this transition (e.g., VERIFY, SHIP)
      // Just update the stage
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { stage: targetStage },
      });

      return NextResponse.json({ success: true });
    }

    // Create job record
    const job = await prisma.job.create({
      data: {
        ticketId,
        command,
        status: 'pending',
        branch: `feature/ticket-${ticketId}`,
      },
    });

    // Dispatch GitHub Actions workflow
    await octokit.actions.createWorkflowDispatch({
      owner: ticket.project.githubOwner,
      repo: ticket.project.githubRepo,
      workflow_id: 'speckit.yml',
      ref: 'main',
      inputs: {
        ticket_id: ticketId.toString(),
        command,
        branch: `feature/ticket-${ticketId}`,
      },
    });

    // Update ticket stage
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { stage: targetStage },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: `Spec-kit command '${command}' dispatched`,
    });
  } catch (error) {
    console.error('Transition error:', error);
    return NextResponse.json(
      { error: 'Failed to transition ticket' },
      { status: 500 }
    );
  }
}
```

### Webhook Handler (Optional)

For real-time job status updates, configure GitHub webhook:

Create `app/api/webhooks/github/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function POST(request: NextRequest) {
  const event = request.headers.get('X-GitHub-Event');
  const payload = await request.json();

  if (event === 'workflow_run') {
    const { workflow_run } = payload;

    // Extract ticket_id from workflow inputs
    const ticketId = parseInt(workflow_run.inputs?.ticket_id);

    if (ticketId) {
      await prisma.job.updateMany({
        where: {
          ticketId,
          status: 'pending',
        },
        data: {
          status: workflow_run.conclusion === 'success' ? 'completed' : 'failed',
          completedAt: new Date(),
        },
      });
    }
  }

  return NextResponse.json({ success: true });
}
```

## Database Schema

Update `prisma/schema.prisma`:

```prisma
enum Stage {
  INBOX
  SPECIFY
  PLAN
  BUILD
  VERIFY
  SHIP
}

enum JobStatus {
  pending
  running
  completed
  failed
}

model Project {
  id            Int      @id @default(autoincrement())
  name          String   @db.VarChar(100)
  description   String?  @db.VarChar(500)
  githubOwner   String   @db.VarChar(100)
  githubRepo    String   @db.VarChar(100)
  githubToken   String?  @db.VarChar(200) // Encrypted PAT
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tickets       Ticket[]

  @@unique([githubOwner, githubRepo])
  @@index([githubOwner, githubRepo])
}

model Ticket {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(100)
  description String   @db.VarChar(1000)
  stage       Stage    @default(INBOX)
  autoMode    Boolean  @default(false)
  branch      String?  @db.VarChar(200)
  prUrl       String?  @db.VarChar(500)
  projectId   Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  jobs        Job[]

  @@index([stage])
  @@index([projectId])
  @@index([updatedAt])
}

model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  command     String    @db.VarChar(50)  // specify, plan, task, implement
  status      JobStatus @default(pending)
  branch      String    @db.VarChar(200)
  commitSha   String?   @db.VarChar(40)
  logs        String?   @db.Text
  startedAt   DateTime  @default(now())
  completedAt DateTime?

  ticket      Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([ticketId])
  @@index([status])
  @@index([startedAt])
}
```

## Environment Variables

### Development (`.env.local`)

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/aiboard_dev"

# Anthropic Claude API
ANTHROPIC_API_KEY="sk-ant-api03-..."

# GitHub Personal Access Token
# Scopes needed: repo, workflow
GITHUB_TOKEN="ghp_..."

# App Configuration
GITHUB_OWNER="your-username"
GITHUB_REPO="ai-board"
```

### Production (Vercel Environment Variables)

```bash
# Database (Neon or Supabase)
DATABASE_URL="postgresql://..."

# Anthropic Claude API
ANTHROPIC_API_KEY="sk-ant-..."

# GitHub Integration
GITHUB_TOKEN="ghp_..."
GITHUB_OWNER="your-org"
GITHUB_REPO="ai-board"
```

## Local Development Setup

### Prerequisites

```bash
# Install required tools
brew install node@22     # Node.js 22.20.0 LTS
brew install docker      # For PostgreSQL
brew install act         # GitHub Actions locally (optional)

# Install global packages
npm install -g @anthropic-ai/claude-code
pip install uv && uv pip install spec-kit
```

### Setup Steps

1. **Clone repository:**
```bash
git clone https://github.com/your-org/ai-board.git
cd ai-board
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start PostgreSQL:**
```bash
docker run -d \
  --name aiboard-postgres \
  -e POSTGRES_USER=aiboard \
  -e POSTGRES_PASSWORD=dev123 \
  -e POSTGRES_DB=aiboard_dev \
  -p 5432:5432 \
  postgres:14
```

4. **Run migrations:**
```bash
npx prisma migrate dev
npx prisma generate
```

5. **Create `.env.local`:**
```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

6. **Start development server:**
```bash
npm run dev
```

7. **Test GitHub Actions locally (optional):**
```bash
# Create test event file
cat > .github/events/specify.json <<EOF
{
  "inputs": {
    "ticket_id": "1",
    "command": "specify",
    "branch": "feature/ticket-1"
  }
}
EOF

# Run workflow locally
act workflow_dispatch \
  -e .github/events/specify.json \
  -s ANTHROPIC_API_KEY="sk-ant-..." \
  -s GITHUB_TOKEN="ghp_..."
```

## Deployment Guide

### 1. Setup GitHub Repository Secrets

Go to `Settings > Secrets and variables > Actions`:

- `ANTHROPIC_API_KEY`: Your Claude API key
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

### 2. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### 3. Configure Vercel Environment Variables

In Vercel dashboard → Settings → Environment Variables:

- `DATABASE_URL`: PostgreSQL connection string from Neon/Supabase
- `ANTHROPIC_API_KEY`: Your Claude API key
- `GITHUB_TOKEN`: Personal Access Token with `repo` scope
- `GITHUB_OWNER`: Your GitHub username/org
- `GITHUB_REPO`: Repository name

### 4. Setup Database (Neon.tech)

```bash
# Create Neon project at https://neon.tech
# Copy connection string

# Run migrations
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

### 5. Configure GitHub Webhook (Optional)

Repository Settings → Webhooks → Add webhook:
- Payload URL: `https://your-app.vercel.app/api/webhooks/github`
- Content type: `application/json`
- Events: Select `Workflow runs`

## Cost Breakdown (MVP)

| Service | Tier | Cost | Notes |
|---------|------|------|-------|
| **GitHub Actions** | Free | $0 | 2000 min/month included |
| **Vercel** | Hobby | $0 | Free for personal projects |
| **Neon PostgreSQL** | Free | $0 | 0.5 GB storage, 10GB transfer |
| **Anthropic Claude API** | Pay-as-you-go | ~$5-20/month | Depends on usage |
| **Total** | | **$5-20/month** | Scale up as needed |

## Limitations & Workarounds

### GitHub Actions Timeout (🚨 CRITICAL)
- **Hard Limit**: 6 hours per job (360 minutes)
- **Configured Limit**: 2 hours (120 minutes) for faster failure feedback
- **Risk**: `/implement` can take 15-90min for complex features
- **Probability**: 10-20% of jobs exceed 1h, <5% exceed 2h, <0.1% hit 6h limit
- **Workarounds**:
  1. **Break down large tickets** into smaller sub-tickets (recommended)
  2. **Use self-hosted runner** for jobs needing >2h (adds complexity)
  3. **Migrate to Target architecture** if >30% of jobs exceed 1h

### GitHub Actions Quota
- **Limit**: 2000 free minutes/month
- **Usage**: ~1-2 min per spec-kit command (except `/implement`: 15-90min)
- **Realistic Capacity**:
  - Simple tickets (2min avg): ~1000 tickets/month
  - Complex tickets (30min avg): ~65 tickets/month
  - Mixed workload: ~100-200 tickets/month
- **Workaround**: Upgrade to GitHub Team ($4/user/month) for 3000 min/month

### Execution Latency
- **Issue**: 20-40s delay (queue + boot time)
- **Impact**: Slower than Docker approach (~5-10s)
- **Mitigation**: Use manual mode for time-sensitive tasks

### No Real-time Updates
- **Issue**: Requires polling or webhooks for job status
- **Solution**: Implement webhook handler or poll every 5s

## Migration Path to Target Architecture

When ready to scale:

1. **Add Redis** for job queue (BullMQ)
2. **Deploy workers** on Fly.io Machines
3. **Switch to Docker** containers for execution
4. **Implement GitHub App** instead of PAT
5. **Add monitoring** (Sentry, DataDog)

See `architecture-target.md` for details.

## Testing Strategy

### Unit Tests
```typescript
// Test API route
describe('POST /api/tickets/[id]/transition', () => {
  it('creates job and dispatches workflow', async () => {
    const res = await POST(mockRequest, { params: { id: '1' } });
    expect(res.status).toBe(200);
    expect(mockOctokit.actions.createWorkflowDispatch).toHaveBeenCalled();
  });
});
```

### E2E Tests (Playwright)
```typescript
test('auto mode ticket workflow', async ({ page }) => {
  // Create ticket in auto mode
  await page.goto('/board');
  await page.click('[data-testid="new-ticket"]');
  await page.fill('[name="title"]', 'Test feature');
  await page.check('[name="autoMode"]');
  await page.click('[data-testid="create"]');

  // Drag to SPECIFY
  await dragTicket('INBOX', 'SPECIFY');

  // Wait for job completion
  await page.waitForSelector('[data-stage="PLAN"]', { timeout: 60000 });

  // Verify spec file created
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/specs/1/spec.md`);
  expect(response.ok).toBe(true);
});
```

## Troubleshooting

### Workflow not triggering
- Check GitHub Token has `workflow` scope
- Verify workflow file path: `.github/workflows/speckit.yml`
- Check Octokit dispatch call in API route

### Spec-kit command fails
- Verify `ANTHROPIC_API_KEY` is set in GitHub Secrets
- Check Claude API rate limits (50 req/min)
- Review workflow logs in Actions tab

### Commits not pushing
- Verify Git user config in workflow
- Check branch exists and is not protected
- Ensure GitHub Token has `repo` scope

## Next Steps

- Implement webhook handler for real-time updates
- Add job status polling in UI
- Create spec viewer component
- Implement PR creation in VERIFY stage
- Add error handling and retry logic

See `architecture-target.md` for scalable production architecture.
