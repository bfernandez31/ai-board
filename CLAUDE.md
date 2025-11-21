# AI-Board Development Guidelines

## Tech Stack

- **Core**: TypeScript 5.6 (strict), Node.js 22.20.0, Next.js 15 (App Router), React 18
- **Database**: PostgreSQL 14+, Prisma 6.x
- **Styling**: TailwindCSS 3.4, shadcn/ui, lucide-react
- **State**: TanStack Query v5.90.5, client-side polling (2s interval)
- **Testing**: Playwright (E2E), Vitest (unit)
- **Auth**: NextAuth.js (session-based)

## Commands

```bash
bun run dev          # Start dev server
bun run test         # Run all tests
bun run test:e2e     # Playwright tests
bun run test:unit    # Vitest tests
bun run type-check   # TypeScript check
```

## Key Architecture Decisions

### Multi-Repository Support

- **Centralized Workflow Execution**: All workflows execute on ai-board repository
- Workflows clone target repository via `githubRepository` input (format: `owner/repo`)
- **No workflow files required in external projects** - only `.claude/commands/` and `.specify/scripts/bash/`
- Target repos need `GH_PAT` secret for cross-repo access
- Supports both self-management (ai-board managing itself) and external projects

### Stage Transitions

**Normal**: INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP
**Quick**: INBOX → BUILD (for simple fixes, bypasses spec/plan)

### Authentication & Authorization

- Every project has an owner (`userId` foreign key)
- Members can access projects alongside owners
- Test mode: Auto-login as `test@e2e.local` when `NODE_ENV !== 'production'`

### Test Environment

- **Projects 1-2**: Reserved for E2E tests (auto-cleaned)
- **Project 3+**: Development and production
- **Test prefix**: All test data must use `[e2e]` prefix

## Data Models

### Project
- `key`: 3-char unique identifier (e.g., "ABC")
- `githubOwner`, `githubRepo`: External repository
- `clarificationPolicy`: AUTO|CONSERVATIVE|PRAGMATIC|INTERACTIVE

### Ticket
- `ticketKey`: Format `{PROJECT_KEY}-{NUMBER}` (e.g., "ABC-123")
- `branch`: Git branch (created by workflow, not transition)
- `workflowType`: FULL|QUICK (tracks which path was used)
- `previewUrl`: Vercel deployment URL (VERIFY stage)

### Job
- Tracks workflow execution: PENDING → RUNNING → COMPLETED|FAILED|CANCELLED
- Commands: `specify`, `plan`, `implement`, `quick-impl`, `deploy-preview`, `comment-*`

## API Patterns

### Authorization Helpers
```typescript
verifyProjectAccess(projectId)  // Owner OR member
verifyTicketAccess(ticketId)    // Via parent project
verifyProjectOwnership(projectId) // Owner only
```

### Workflow Dispatch
```typescript
// All workflows use combined format
workflowInputs = {
  githubRepository: `${owner}/${repo}`,
  // ... other inputs
}
```

### Job Status Updates
- PATCH `/api/jobs/:id/status` (workflow token auth)
- GET `/api/projects/:projectId/jobs/status` (polling endpoint)

## GitHub Workflows

1. **speckit.yml**: SPECIFY/PLAN/BUILD stages
2. **quick-impl.yml**: Direct INBOX→BUILD
3. **verify.yml**: Test execution and PR creation
4. **deploy-preview.yml**: Vercel deployment
5. **ai-board-assist.yml**: AI-powered assistance (@ai-board mentions)

## Deploy Preview System

- Manual trigger from VERIFY stage tickets
- Single preview per project (auto-replaces)
- Requires: branch exists, latest job COMPLETED
- Updates `ticket.previewUrl` on success

## AI-BOARD Assistant

- Triggered by `@ai-board` mention in comments
- Available in SPECIFY/PLAN/BUILD/VERIFY stages
- Creates `comment-{stage}` jobs
- Dispatches to Claude for assistance

## Testing Guidelines

### E2E Test Pattern
```typescript
// Always create test user first
const testUser = await prisma.user.upsert({
  where: { email: 'test@e2e.local' },
  update: {},
  create: { email: 'test@e2e.local', name: 'E2E Test User' }
});

// Then create projects with [e2e] prefix
await prisma.project.create({
  name: '[e2e] Test Project',
  userId: testUser.id
});
```

### State Machine Testing
- Test all valid transitions
- Test invalid transitions (should return 400)
- Test idempotency (same status → 200)

## Development Workflow

1. **Create ticket** in INBOX
2. **Choose path**:
   - Normal: Drag to SPECIFY (blue border) → auto workflow
   - Quick: Drag to BUILD (green border) → confirm modal → quick-impl
3. **Workflow creates branch**: `{num}-{description}`
4. **Stage transitions** update ticket, create jobs
5. **VERIFY stage**: Manual deploy preview option
6. **SHIP**: Manual completion

## Important Notes

- Branch creation happens IN workflow, not during transition
- Jobs track workflow status (polling updates UI)
- Quick-impl sets `workflowType=QUICK` permanently
- Preview URLs are single per project
- All test data must use `[e2e]` prefix for cleanup
