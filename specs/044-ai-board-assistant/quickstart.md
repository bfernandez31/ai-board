# Quickstart Guide: AI-BOARD Assistant

**Branch**: `044-ai-board-assistant` | **Date**: 2025-10-23
**Audience**: Developers implementing this feature

## Prerequisites

- Node.js 22.20.0 LTS
- PostgreSQL 14+ running locally
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
- GitHub repository access

## Setup Steps

### 1. Database: Create AI-BOARD User

Add AI-BOARD user to seed script:

```bash
# Edit prisma/seed.ts
```

Add this code after admin user creation:

```typescript
// Create AI-BOARD system user
const aiBoardUser = await prisma.user.upsert({
  where: { email: 'ai-board@system.local' },
  update: {},
  create: {
    id: 'ai-board-system-user',
    email: 'ai-board@system.local',
    name: 'AI-BOARD Assistant',
    emailVerified: new Date(),
    updatedAt: new Date(),
  },
});

console.log('Created/verified AI-BOARD user:', aiBoardUser);
```

Run seed script:

```bash
npm run db:seed
```

Verify AI-BOARD user exists:

```bash
npx prisma studio
# Check Users table for ai-board@system.local
```

### 2. Environment Variables

Add these to `.env.local`:

```bash
# Claude API key for workflow execution
ANTHROPIC_API_KEY=sk-ant-api03-...

# Workflow authentication token (generate random secure string)
WORKFLOW_API_TOKEN=your-secure-random-token-here

# Application URL for workflow API calls
APP_URL=http://localhost:3000
```

Generate secure token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to GitHub repository secrets:
1. Go to repository Settings → Secrets and variables → Actions
2. Add `ANTHROPIC_API_KEY` secret
3. Add `WORKFLOW_API_TOKEN` secret (same value as `.env.local`)

### 3. Implementation Order

Follow this sequence (detailed tasks in `tasks.md` after running `/speckit.tasks`):

1. **Core Utilities** (no dependencies)
   - `app/lib/db/ai-board-user.ts` - User ID helper
   - `app/lib/utils/ai-board-availability.ts` - Availability validation
   - `app/lib/auth/workflow-auth.ts` - Workflow token verification

2. **API Routes** (depends on utilities)
   - `app/api/projects/[projectId]/tickets/[id]/comments/ai-board/route.ts` - New endpoint
   - Modify `app/api/projects/[projectId]/tickets/[id]/comments/route.ts` - Add mention detection
   - Modify `app/api/projects/route.ts` - Add auto-membership (if POST endpoint exists)

3. **Workflow Components** (depends on API routes)
   - `.github/workflows/ai-board-assist.yml` - GitHub workflow
   - `.claude/commands/ai-board-assist.md` - Claude command
   - `app/lib/workflows/dispatch-ai-board.ts` - Workflow dispatcher

4. **UI Components** (can proceed in parallel)
   - `app/hooks/use-ai-board-availability.ts` - React hook
   - Modify `app/components/comments/mention-input.tsx` - Add availability UI

5. **Tests** (write BEFORE each implementation task - TDD)
   - API contract tests
   - E2E workflow tests
   - UI interaction tests

## Local Testing

### Test AI-BOARD User Lookup

```typescript
// In Node REPL or test script
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const user = await prisma.user.findUnique({
  where: { email: 'ai-board@system.local' },
});

console.log('AI-BOARD User:', user);
// Expected: { id: 'ai-board-system-user', email: 'ai-board@system.local', ... }
```

### Test Workflow Token Authentication

```bash
# Start dev server
npm run dev

# Test workflow endpoint (should fail with 401)
curl -X POST http://localhost:3000/api/projects/1/tickets/1/comments/ai-board \
  -H "Content-Type: application/json" \
  -d '{"content": "test", "userId": "ai-board-system-user"}'

# Test with valid token (should succeed or return validation error)
curl -X POST http://localhost:3000/api/projects/1/tickets/1/comments/ai-board \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token-here" \
  -d '{"content": "@[user-123:Test] Test message", "userId": "ai-board-system-user"}'
```

### Mock Workflow Execution

For local testing without triggering GitHub workflow:

```typescript
// Create test script: scripts/test-ai-board-workflow.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testWorkflow() {
  const command = `claude "/ai-board-assist" --stage=specify --comment="@ai-board add error handling"`;

  try {
    const { stdout } = await execAsync(command);
    console.log('Claude Output:', stdout);

    // Parse JSON from output
    const jsonMatch = stdout.match(/\{.*\}/s);
    if (jsonMatch) {
      const response = JSON.parse(jsonMatch[0]);
      console.log('Parsed Response:', response);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testWorkflow();
```

Run test:

```bash
npx tsx scripts/test-ai-board-workflow.ts
```

## Debugging

### Workflow Failures

Check GitHub Actions logs:
1. Go to repository → Actions tab
2. Find "AI-BOARD Assist" workflow run
3. Click on failed job
4. Expand each step to view logs

Common issues:
- **Job Status Not Updated**: Check `WORKFLOW_API_TOKEN` secret matches `.env.local`
- **Claude Output Parse Error**: Check JSON format in Claude command output
- **Branch Checkout Failed**: Verify ticket has valid branch field

### Job Logs

Query job logs from database:

```sql
SELECT id, ticketId, command, status, startedAt, completedAt, logs
FROM "Job"
WHERE command LIKE 'comment-%'
ORDER BY startedAt DESC
LIMIT 10;
```

### AI-BOARD Comment Creation

Check if comments are created:

```sql
SELECT c.id, c.content, c.createdAt, u.email
FROM "Comment" c
JOIN "User" u ON c.userId = u.id
WHERE u.email = 'ai-board@system.local'
ORDER BY c.createdAt DESC;
```

## Testing Checklist

Before marking feature complete, verify:

- [ ] AI-BOARD user exists in database
- [ ] AI-BOARD auto-added to new projects (if POST /api/projects implemented)
- [ ] Mention detection works in comment POST endpoint
- [ ] Availability validation prevents mentions in INBOX/SHIP stages
- [ ] Availability validation prevents mentions when job running
- [ ] GitHub workflow dispatches successfully on @ai-board mention
- [ ] [e2e] tickets skip Claude execution but complete workflow
- [ ] BUILD/VERIFY stages post "not implemented" message
- [ ] SPECIFY stage updates spec.md correctly
- [ ] PLAN stage updates plan.md/tasks.md correctly
- [ ] AI-BOARD comments posted with correct authorship
- [ ] Job status updates to COMPLETED on success
- [ ] Job status updates to FAILED on error
- [ ] UI shows AI-BOARD greyed out when unavailable
- [ ] UI tooltip messages are correct
- [ ] All E2E tests pass

## Performance Benchmarks

Target performance metrics:

- API response time: <200ms p95 for comment creation
- Workflow dispatch: <500ms from mention to workflow trigger
- Mention validation: <100ms client-side check
- Job status update: <30s after workflow completion

Test with Playwright:

```typescript
test('AI-BOARD mention performance', async ({ page }) => {
  const startTime = Date.now();

  // Post comment with @ai-board mention
  await page.fill('[data-testid="comment-input"]', '@ai-board test');
  await page.click('[data-testid="post-comment"]');

  // Verify response within threshold
  await expect(page.locator('.comment-loading')).toBeVisible({ timeout: 500 });

  const elapsed = Date.now() - startTime;
  expect(elapsed).toBeLessThan(500);
});
```

## Next Steps

After completing implementation:

1. Run `/speckit.tasks` to generate detailed task list
2. Write E2E tests BEFORE implementing each task (TDD)
3. Implement tasks in dependency order (see Implementation Order above)
4. Verify all tests pass: `npm run test:e2e`
5. Update `CLAUDE.md` with new patterns (agent context update script)
6. Create pull request with comprehensive description

## Support

- **Documentation**: See `spec.md`, `plan.md`, `data-model.md`, `contracts/`
- **Research Decisions**: See `research.md` for technical rationale
- **Existing Patterns**: Review similar features (Job status updates, comment creation)
- **Issues**: Check GitHub repository issues for AI-BOARD related problems
