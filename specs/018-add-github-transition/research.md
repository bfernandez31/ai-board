# Research: GitHub Workflow Transition API

**Feature**: 018-add-github-transition
**Date**: 2025-10-09

## Research Summary

This document consolidates technology decisions and integration patterns for the GitHub workflow transition API. Since the feature leverages well-established technologies and follows existing codebase patterns, minimal exploratory research was required.

---

## Decision 1: GitHub Actions Integration with Octokit

**Context**: Need to programmatically trigger GitHub Actions workflows from Next.js API route.

**Decision**: Use `@octokit/rest` package (v21.x) for GitHub Actions workflow dispatch.

**Rationale**:
- Official GitHub REST API client with full TypeScript support
- Well-maintained by GitHub (25K+ stars, active development)
- Handles authentication, rate limiting, and error responses automatically
- Type-safe workflow dispatch via `octokit.actions.createWorkflowDispatch()`
- Established in Node.js ecosystem with 50M+ weekly downloads

**Alternatives Considered**:
1. **Direct REST API calls via fetch**
   - ❌ Rejected: No built-in type safety, manual auth token handling, error parsing complexity
   - Would require 100+ lines of boilerplate for what Octokit provides in 10 lines

2. **GitHub CLI (`gh`) via child_process**
   - ❌ Rejected: Requires shell execution in serverless environment, harder error handling, adds system dependency
   - Vercel serverless functions prefer pure JavaScript libraries over system commands

**Implementation Pattern**:
```typescript
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

await octokit.actions.createWorkflowDispatch({
  owner: ticket.project.githubOwner,
  repo: ticket.project.githubRepo,
  workflow_id: 'speckit.yml',
  ref: 'main',
  inputs: {
    ticket_id: ticketId.toString(),
    command: 'specify',
    branch: 'feature/ticket-123'
  }
});
```

**Error Handling**:
- 401 Unauthorized: Invalid/expired GITHUB_TOKEN
- 403 Forbidden: Rate limit exceeded (5000 req/hour) or insufficient permissions
- 404 Not Found: Workflow file doesn't exist or repo access denied
- 422 Unprocessable Entity: Invalid workflow inputs

---

## Decision 2: Stage-to-Command Mapping Strategy

**Context**: Map ticket stages (SPECIFY, PLAN, BUILD) to spec-kit commands (specify, plan, implement).

**Decision**: Use type-safe lookup object with null for non-automated stages.

```typescript
const STAGE_COMMAND_MAP: Record<Stage, string | null> = {
  INBOX: null,
  SPECIFY: 'specify',
  PLAN: 'plan',
  BUILD: 'implement',
  VERIFY: null,
  SHIP: null
};
```

**Rationale**:
- **Type Safety**: Compiler enforces all Stage enum values are handled
- **Clarity**: Explicit null for non-automated stages (INBOX, VERIFY, SHIP)
- **Maintainability**: Single source of truth, easy to add new stages
- **Performance**: O(1) lookup vs. O(n) for switch/if-else chains

**Alternatives Considered**:
1. **Switch Statement**
   - ❌ Rejected: Verbose (6 cases), error-prone (easy to miss a case), no compile-time completeness check

2. **String Manipulation** (e.g., `stage.toLowerCase()`)
   - ❌ Rejected: Fragile (breaks if stage names change), no type safety, doesn't handle special cases (BUILD→implement)

**Usage Pattern**:
```typescript
const command = STAGE_COMMAND_MAP[targetStage];
if (!command) {
  // Update stage only (VERIFY, SHIP)
  await updateTicketStage(ticketId, targetStage);
  return { success: true, message: 'Stage updated (no workflow)' };
}

// Dispatch workflow for automated stages
const job = await createJob(ticketId, command);
await dispatchWorkflow(ticket, command);
```

---

## Decision 3: Branch Naming Convention

**Context**: Generate Git branch names for new spec-kit workflows.

**Decision**: Use `feature/ticket-<id>` format (e.g., `feature/ticket-123`) for SPECIFY stage only.

**Rationale**:
- **Traceability**: Ticket ID provides direct link between branch and ticket
- **Convention Alignment**: Matches spec-kit workflow expectations (branch created by `/specify` command)
- **Human-Readable**: Clear semantic meaning vs. UUID or random strings
- **Existing Pattern**: Aligns with GitHub branch naming conventions already used in codebase

**Alternatives Considered**:
1. **User-Provided Branch Names**
   - ❌ Rejected: Out of scope for this ticket, adds UI complexity, validation overhead

2. **UUID-Based Branches** (e.g., `ticket-a3b2c1d4`)
   - ❌ Rejected: Less human-readable, harder to trace back to ticket without lookup

**Implementation**:
```typescript
// Only for SPECIFY stage (initial transition from INBOX)
if (targetStage === Stage.SPECIFY) {
  const branchName = `feature/ticket-${ticketId}`;

  // Update ticket.branch field
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { branch: branchName }
  });

  // Pass branch to workflow dispatch
  await dispatchWorkflow({ ...ticket, branch: branchName }, 'specify');
}
```

**Branch Lifecycle**:
- Created: INBOX → SPECIFY transition
- Reused: SPECIFY → PLAN, PLAN → BUILD transitions
- Not used: VERIFY and SHIP stages (no workflow automation)

---

## Decision 4: Error Handling and HTTP Status Codes

**Context**: Consistent error responses matching existing API route patterns.

**Decision**: Follow established HTTP status code conventions from `/app/api/projects/[projectId]/tickets/[id]/route.ts`.

**Status Code Mapping**:
| Status | Scenario | Response Body |
|--------|----------|---------------|
| 200 OK | Successful transition | `{ success: true, jobId?: number, message: string }` |
| 400 Bad Request | Invalid input, validation failure, invalid transition | `{ error: string, code?: string, issues?: ZodIssue[] }` |
| 403 Forbidden | Cross-project access attempt | `{ error: "Forbidden", code: "FORBIDDEN" }` |
| 404 Not Found | Project or ticket not found | `{ error: string, code?: string }` |
| 409 Conflict | Optimistic concurrency version mismatch | `{ error: string, currentVersion: number }` |
| 500 Internal Server Error | Database errors, Octokit failures | `{ error: string, message?: string, code?: string }` |

**Error Handling Pattern**:
```typescript
try {
  // Validation
  const parseResult = TransitionRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parseResult.error.issues },
      { status: 400 }
    );
  }

  // Business logic
  // ...

} catch (error) {
  console.error('Error transitioning ticket:', error);

  // Octokit-specific errors
  if (error instanceof RequestError) {
    if (error.status === 403) {
      return NextResponse.json(
        { error: 'GitHub rate limit exceeded', code: 'RATE_LIMIT' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

**Logging Strategy**:
- All workflow dispatch attempts logged with ticket ID, command, branch
- Errors include full context (projectId, ticketId, targetStage, error message)
- No sensitive data logged (GITHUB_TOKEN excluded)

---

## Dependencies and Installation

**New Dependencies**:
```bash
npm install @octokit/rest
```

**Environment Variables** (.env.local):
```bash
GITHUB_TOKEN=ghp_...  # Classic token with repo + workflow scopes
```

**Token Permissions Required**:
- `repo` scope (full repository access)
- `workflow` scope (trigger GitHub Actions workflows)

**Existing Dependencies** (reused):
- `@prisma/client` - Database queries
- `zod` - Request validation
- `next` - API route framework

---

## Performance Considerations

**GitHub API Rate Limits**:
- Authenticated requests: 5000/hour per token
- Workflow dispatch: No additional limits beyond general API quota
- Expected usage: ~10-50 dispatches/day (~0.4-2.1% of quota)

**API Response Times**:
- Database queries: <100ms (indexed lookups on projectId, ticketId)
- Octokit dispatch: <2s (typical GitHub API response time)
- Total endpoint latency: <2.5s (well under 10s Vercel timeout)

**Optimization Opportunities**:
- Database queries use existing indexes (no new indexes needed)
- Prisma connection pooling handles concurrent requests
- No caching needed (state transitions are infrequent, high-consistency required)

---

## Security Considerations

**Input Validation**:
- projectId/ticketId: Validated as positive integers, checked against database
- targetStage: Validated against Stage enum, checked via `isValidTransition()`
- All inputs sanitized via Zod schemas before database queries

**Authentication & Authorization**:
- GITHUB_TOKEN stored in environment variables, never exposed in responses
- Cross-project access prevented via `projectId` validation in WHERE clause
- Octokit handles token-based authentication with GitHub API

**Data Exposure**:
- Job logs NOT returned in API responses (may contain sensitive workflow output)
- Error messages don't expose internal paths or stack traces
- GitHub repository details (owner/repo) only from database, not user input

---

## Testing Strategy

**Contract Tests** (Playwright):
1. Valid SPECIFY transition (job created, branch generated)
2. Valid PLAN transition (job created, existing branch used)
3. VERIFY stage (no job, no workflow)
4. Invalid transition (400 error)
5. Cross-project access (403 error)
6. Missing project (404 error)
7. Octokit error handling (500 error with rate limit simulation)

**E2E Tests**:
- Full user journey: INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP
- Verify job records created at each automated stage
- Verify ticket.branch populated after SPECIFY
- Verify GitHub Actions workflow triggered (mock Octokit in tests)

**Manual Testing Checklist**:
- [ ] Real GitHub repository workflow dispatch
- [ ] Rate limit error handling
- [ ] Invalid token error handling
- [ ] Missing workflow file (404) handling
- [ ] Concurrent transitions (optimistic concurrency)

---

## References

- [Octokit REST API Documentation](https://octokit.github.io/rest.js/)
- [GitHub Actions Workflow Dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
- [Next.js API Routes Documentation](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Prisma Transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [Zod Validation](https://zod.dev/)

---

**Status**: ✅ Research complete - All technical decisions documented
**Next Phase**: Phase 1 (Design & Contracts)
