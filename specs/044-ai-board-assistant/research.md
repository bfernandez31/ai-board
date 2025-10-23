# Research & Decision Documentation: AI-BOARD Assistant

**Branch**: `044-ai-board-assistant` | **Date**: 2025-10-23
**Purpose**: Resolve technical unknowns and document design decisions before implementation

## Research Task 1: GitHub Workflow Dispatch Authentication

### Decision
Use GitHub workflow token (`WORKFLOW_API_TOKEN` secret) with Bearer authentication header for AI-BOARD comment endpoint.

### Rationale
- **Existing Pattern**: The codebase already uses `WORKFLOW_API_TOKEN` secret in speckit.yml workflow (lines 75, 96)
- **Security**: Workflow token is scoped to GitHub Actions only, cannot be used from browser
- **Simplicity**: Single authentication mechanism for all workflow-initiated API calls
- **Consistency**: Matches existing Job status update pattern (`Authorization: Bearer ${WORKFLOW_API_TOKEN}`)

### Alternatives Considered
1. **GitHub `GITHUB_TOKEN`**: Limited permissions, requires additional GitHub API setup
2. **Custom API Key**: Requires separate secret management, adds complexity
3. **No Authentication**: Rejected - security vulnerability (anyone could post as AI-BOARD)

### Implementation Notes
- AI-BOARD comment endpoint validates `Authorization: Bearer {token}` header
- Token verification against `process.env.WORKFLOW_API_TOKEN`
- Return 401 Unauthorized if token missing/invalid, 403 Forbidden if token valid but not workflow context

---

## Research Task 2: AI-BOARD User ID Retrieval Pattern

### Decision
Create utility function `getAIBoardUserId()` with in-memory caching that performs database lookup on first call.

### Rationale
- **Performance**: Single database query per server instance, cached in memory for subsequent calls
- **Consistency**: Central source of truth for AI-BOARD user ID (email lookup)
- **Error Handling**: Throws descriptive error if AI-BOARD user not found (fails fast)
- **Testability**: Easy to mock in tests

### Alternatives Considered
1. **Environment Variable**: Requires manual ID management, breaks if database is reset
2. **Hardcoded Constant**: Fragile, breaks if user deleted and recreated
3. **No Caching**: Database query on every request, unnecessary load

### Implementation Notes
```typescript
// app/lib/db/ai-board-user.ts
let cachedAIBoardUserId: string | null = null;

export async function getAIBoardUserId(): Promise<string> {
  if (cachedAIBoardUserId) return cachedAIBoardUserId;

  const user = await prisma.user.findUnique({
    where: { email: 'ai-board@system.local' },
    select: { id: true },
  });

  if (!user) {
    throw new Error('AI-BOARD user not found - run seed script');
  }

  cachedAIBoardUserId = user.id;
  return user.id;
}
```

---

## Research Task 3: Mention Detection in Comment Content

### Decision
Reuse existing `extractMentionUserIds()` function from `mention-parser.ts` and filter for AI-BOARD user ID in business logic.

### Rationale
- **Code Reuse**: Existing parser handles mention format `@[userId:displayName]` correctly
- **Single Responsibility**: Parser extracts all user IDs, business logic filters for AI-BOARD
- **Maintainability**: Changes to mention format only affect parser, not AI-BOARD logic
- **Testability**: Existing parser has test coverage, no duplication needed

### Alternatives Considered
1. **AI-BOARD-Specific Parser**: Duplicates mention regex logic, harder to maintain
2. **Custom Format**: Breaks consistency with existing mention system

### Implementation Notes
```typescript
// In POST /api/projects/:projectId/tickets/:id/comments
const mentionedUserIds = extractMentionUserIds(content);
const aiBoardUserId = await getAIBoardUserId();
const aiBoardMentioned = mentionedUserIds.includes(aiBoardUserId);

if (aiBoardMentioned) {
  // Validate availability, create Job, dispatch workflow
}
```

---

## Research Task 4: Job Status Locking Strategy

### Decision
Use database transaction with `SELECT ... FOR UPDATE` (Prisma implicit locking) when checking for existing running jobs before Job creation.

### Rationale
- **Race Condition Prevention**: PostgreSQL row-level locking prevents concurrent job creation
- **Existing Pattern**: Prisma transactions already used in codebase (e.g., project creation)
- **Simplicity**: No application-level mutex needed, database handles concurrency
- **Atomicity**: Job existence check + creation happen atomically

### Alternatives Considered
1. **Optimistic Concurrency Control**: Requires retry logic, more complex
2. **Application-Level Mutex**: Doesn't scale across multiple server instances
3. **Unique Constraint**: Database-level constraint but worse error messaging

### Implementation Notes
```typescript
await prisma.$transaction(async (tx) => {
  // Check for existing running jobs (implicitly locks ticket row)
  const runningJob = await tx.job.findFirst({
    where: {
      ticketId,
      status: { in: ['PENDING', 'RUNNING'] },
    },
  });

  if (runningJob) {
    throw new Error('AI-BOARD already processing this ticket');
  }

  // Create new job atomically
  const job = await tx.job.create({ data: {...} });
  return job;
});
```

---

## Research Task 5: Claude CLI JSON Output Parsing

### Decision
Use `jq` utility in GitHub workflow to extract JSON from Claude CLI stdout, with fallback error handling for malformed output.

### Rationale
- **Robustness**: `jq` is industry-standard JSON parser, handles mixed stdout (logs + JSON)
- **Error Detection**: Exit code from `jq` indicates parse failure
- **Existing Pattern**: GitHub Actions workflows commonly use `jq` for JSON processing
- **Simplicity**: Single tool for extraction, validation, and field access

### Alternatives Considered
1. **Regex Extraction**: Fragile, fails on nested JSON or escaped characters
2. **Line Filtering**: Assumes JSON is on specific line, breaks if format changes
3. **Node.js Script**: Adds dependency, more complex than `jq`

### Implementation Notes
```yaml
# In .github/workflows/ai-board-assist.yml
- name: Execute Claude Command
  id: claude
  run: |
    OUTPUT=$(claude "/ai-board-assist" --stage="${{ inputs.stage }}" --comment="${{ inputs.comment }}" 2>&1)
    echo "$OUTPUT"

    # Extract JSON response (last valid JSON object in stdout)
    JSON_OUTPUT=$(echo "$OUTPUT" | jq -s '.[-1]' 2>/dev/null || echo '{"status":"error","message":"Failed to parse Claude output"}')
    echo "json_output=$JSON_OUTPUT" >> $GITHUB_OUTPUT

- name: Parse Claude Response
  id: parse
  run: |
    STATUS=$(echo '${{ steps.claude.outputs.json_output }}' | jq -r '.status')
    MESSAGE=$(echo '${{ steps.claude.outputs.json_output }}' | jq -r '.message')
    FILES=$(echo '${{ steps.claude.outputs.json_output }}' | jq -r '.filesModified | join(",")')

    echo "status=$STATUS" >> $GITHUB_OUTPUT
    echo "message=$MESSAGE" >> $GITHUB_OUTPUT
    echo "files=$FILES" >> $GITHUB_OUTPUT
```

---

## Research Task 6: AI-BOARD Comment Author Display

### Decision
Reuse existing Comment component without special styling. AI-BOARD user will have standard avatar and name display.

### Rationale
- **Consistency**: AI-BOARD is a regular user from system perspective, no special treatment needed
- **Simplicity**: No UI changes required beyond mention availability logic
- **Future-Proofing**: If special styling needed later, can add `isSystemUser` flag to User model
- **Accessibility**: Standard user display patterns already accessible

### Alternatives Considered
1. **Bot Badge**: Adds visual complexity, not essential for MVP
2. **Special Avatar**: Requires custom avatar management
3. **Different Comment Style**: Breaks visual consistency

### Implementation Notes
- AI-BOARD user created with name "AI-BOARD Assistant"
- Standard user avatar generation uses initials "AA"
- No component changes needed for comment display

---

## Best Practices: GitHub Actions Workflow

### Workflow Timeout Handling
- Set `timeout-minutes: 120` (same as speckit.yml)
- Update job status to FAILED if timeout occurs (GitHub Actions automatic cleanup)

### Secret Management
- Use `secrets.ANTHROPIC_API_KEY` for Claude CLI authentication
- Use `secrets.WORKFLOW_API_TOKEN` for API calls back to application
- Never expose secrets in workflow logs (`-f -s -S` flags for curl)

### Conditional Execution Patterns
- Skip [e2e] tickets: Check `contains(inputs.ticketTitle, '[e2e]')` in workflow env
- Skip BUILD/VERIFY: Check stage input in early workflow step, post message, exit 0
- Common pattern: `if: ${{ env.SKIP_EXECUTION != 'true' }}` on expensive steps

**Implementation Example**:
```yaml
env:
  SKIP_CLAUDE: ${{ contains(inputs.ticketTitle, '[e2e]') || contains(fromJSON('["build", "verify"]'), inputs.stage) }}

steps:
  - name: Handle Skip Scenarios
    if: ${{ env.SKIP_CLAUDE == 'true' }}
    run: |
      if [[ "${{ inputs.ticketTitle }}" == *"[e2e]"* ]]; then
        MESSAGE="AI-BOARD analysis skipped for test ticket"
      else
        MESSAGE="@${{ inputs.user }} This feature is not yet implemented for ${{ inputs.stage }} stage."
      fi

      # Post skip message via API
      # Update job status to COMPLETED
```

---

## Best Practices: Prisma Transaction Patterns

### Project Creation with Auto-Membership
```typescript
const project = await prisma.$transaction(async (tx) => {
  // Create project
  const newProject = await tx.project.create({
    data: {
      name, description, githubOwner, githubRepo, userId,
      updatedAt: new Date(),
    },
  });

  // Add AI-BOARD as member atomically
  await tx.projectMember.create({
    data: {
      projectId: newProject.id,
      userId: await getAIBoardUserId(),
      role: 'member',
    },
  });

  return newProject;
});
```

### Error Handling and Rollback
- Prisma transactions auto-rollback on thrown errors
- Always throw descriptive errors inside transaction blocks
- Catch transaction errors at route level, return appropriate HTTP status

---

## Best Practices: TanStack Query Integration

### Optimistic Updates for AI-BOARD Mentions
```typescript
// In useCreateComment mutation
onMutate: async (newComment) => {
  // Cancel outgoing refetches
  await queryClient.cancelQueries({ queryKey: ['comments', ticketId] });

  // Snapshot previous value
  const previousComments = queryClient.getQueryData(['comments', ticketId]);

  // Optimistically update with pending job indicator if AI-BOARD mentioned
  if (newComment.content.includes('@[ai-board')) {
    queryClient.setQueryData(['comments', ticketId], (old) => ({
      ...old,
      // Add comment with "pending" indicator
    }));
  }

  return { previousComments };
},
```

### Cache Invalidation After AI-BOARD Responses
- Job status polling detects COMPLETED status
- Invalidate comments query to fetch AI-BOARD response
- Automatic re-render with new comment thread

---

## Best Practices: Next.js API Route Security

### Workflow Token Authentication Middleware
```typescript
// app/lib/auth/workflow-auth.ts
export async function verifyWorkflowToken(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.substring(7);
  const expectedToken = process.env.WORKFLOW_API_TOKEN;

  if (!expectedToken) {
    console.error('WORKFLOW_API_TOKEN not configured');
    return false;
  }

  return token === expectedToken;
}
```

### Request Validation and Error Responses
- Use Zod schemas for all request body validation
- Return structured errors: `{ error: string, code?: string, details?: object }`
- HTTP status codes: 400 (validation), 401 (auth), 403 (forbidden), 500 (internal error)

---

## Summary

All research tasks completed. Key decisions documented with rationale and implementation notes. Ready to proceed to Phase 1 (Design & Contracts).

**Critical Paths**:
1. Database: AI-BOARD user creation via seed script (required first)
2. Authentication: Workflow token validation for AI-BOARD comment endpoint
3. Concurrency: Prisma transaction with implicit locking for job creation
4. Parsing: `jq` utility for JSON extraction from Claude CLI output

**No Blockers**: All decisions made, no unresolved dependencies
