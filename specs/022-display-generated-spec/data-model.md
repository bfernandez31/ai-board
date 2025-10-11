# Data Model: Display Generated Spec.md

**Feature**: 022-display-generated-spec
**Date**: 2025-10-11
**Phase**: Phase 1 - Design & Contracts

## Schema Changes

**No database schema changes required.**

This feature uses existing entities:
- `Ticket` (existing fields: id, branch, projectId)
- `Job` (existing fields: id, ticketId, command, status)
- `Project` (existing fields: id, githubOwner, githubRepo)

## Entity Relationships

```
Project (1) ──────< (N) Ticket (1) ──────< (N) Job
    │                      │                    │
    ├─ githubOwner        ├─ branch           ├─ command
    └─ githubRepo         └─ projectId        └─ status
```

**Relationship Flow**:
1. Ticket belongs to Project (FK: projectId)
2. Job belongs to Ticket (FK: ticketId)
3. Spec file location derived from: `Project.githubOwner/githubRepo` + `specs/${Ticket.branch}/spec.md`

## Business Rules

### Rule 1: Spec File Availability
**Condition**: Spec file exists and is viewable
**Requirements**:
- `Ticket.branch IS NOT NULL`
- At least one `Job` exists where:
  - `Job.ticketId = Ticket.id`
  - `Job.command = 'specify'`
  - `Job.status = 'COMPLETED'`

**Query**:
```typescript
const ticket = await prisma.ticket.findFirst({
  where: {
    id: ticketId,
    projectId: projectId,
    branch: { not: null },
  },
  include: {
    jobs: {
      where: {
        command: 'specify',
        status: 'COMPLETED',
      },
      take: 1,
    },
    project: true,
  },
});

const hasCompletedSpecifyJob = ticket && ticket.jobs.length > 0;
```

### Rule 2: Project-Scoped Access Control
**Condition**: User can only view specs for tickets in their project
**Requirements**:
- `Ticket.projectId` must match requested `projectId`
- Project must exist

**Validation**:
1. Verify project exists (404 if not)
2. Query ticket with `WHERE projectId = ?` filter
3. If ticket exists but wrong project → 403 Forbidden
4. If ticket doesn't exist → 404 Not Found

### Rule 3: File Path Construction
**Condition**: Build correct GitHub file path
**Formula**:
```
path = `specs/${ticket.branch}/spec.md`
ref = ticket.branch
owner = ticket.project.githubOwner
repo = ticket.project.githubRepo
```

**Example**:
- Ticket branch: `022-display-generated-spec`
- Project: `bfernandez31/ai-board`
- Result: `bfernandez31/ai-board/specs/022-display-generated-spec/spec.md` at ref `022-display-generated-spec`

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Client: User clicks "View Specification" button             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend: Fetch GET /api/projects/:projectId/tickets/:id/spec│
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ API Route: Validate projectId and ticketId                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Parse and validate projectId (Zod)                       │
│ 2. Parse and validate ticketId (numeric)                    │
│ 3. Query Project by id                                       │
│ 4. Query Ticket with projectId filter + include jobs/project│
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─ Project not found → 404
                     ├─ Ticket not found → 404
                     ├─ Ticket wrong project → 403
                     ├─ No completed specify job → 404
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ GitHub API: Fetch spec.md content                           │
├─────────────────────────────────────────────────────────────┤
│ 1. Check test mode (skip GitHub API if test)                │
│ 2. Call octokit.repos.getContent()                          │
│    - owner: ticket.project.githubOwner                       │
│    - repo: ticket.project.githubRepo                         │
│    - path: specs/${ticket.branch}/spec.md                   │
│    - ref: ticket.branch                                      │
│ 3. Decode base64 content                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─ File not found → 404
                     ├─ GitHub API error → 500
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ API Response: Return markdown content                        │
├─────────────────────────────────────────────────────────────┤
│ { content: string, metadata: {...} }                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend: Display in SpecViewer modal                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Parse markdown with react-markdown                        │
│ 2. Apply syntax highlighting to code blocks                  │
│ 3. Render in scrollable dialog                               │
└─────────────────────────────────────────────────────────────┘
```

## Validation Rules

### Input Validation (Zod Schemas)

**ProjectIdSchema** (existing):
```typescript
z.string().regex(/^\d+$/, 'Project ID must be numeric')
```

**TicketIdSchema** (inline validation):
```typescript
const ticketId = parseInt(ticketIdString, 10);
if (isNaN(ticketId)) {
  return 400 error
}
```

### Business Logic Validation

**1. Project Exists**:
```typescript
const project = await getProjectById(projectId);
if (!project) {
  return 404 'Project not found'
}
```

**2. Ticket Exists with Project Check**:
```typescript
const ticket = await prisma.ticket.findFirst({
  where: { id: ticketId, projectId: projectId },
  include: { jobs: true, project: true }
});

if (!ticket) {
  // Check if ticket exists elsewhere (403 vs 404)
  const ticketExists = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, projectId: true }
  });

  if (ticketExists) {
    return 403 'Forbidden'
  } else {
    return 404 'Ticket not found'
  }
}
```

**3. Branch Assigned**:
```typescript
if (!ticket.branch) {
  return 404 'Specification not available'
}
```

**4. Completed Specify Job**:
```typescript
const hasCompletedSpecifyJob = ticket.jobs.some(
  job => job.command === 'specify' && job.status === 'COMPLETED'
);

if (!hasCompletedSpecifyJob) {
  return 404 'Specification not available'
}
```

## Error Scenarios

| Scenario | Validation | Status | Message |
|----------|------------|--------|---------|
| Invalid projectId format | Zod schema | 400 | "Invalid project ID" |
| Invalid ticketId format | isNaN check | 400 | "Invalid ticket ID" |
| Project not found | DB query | 404 | "Project not found" |
| Ticket not found | DB query | 404 | "Ticket not found" |
| Ticket in wrong project | DB query | 403 | "Forbidden" |
| Branch not assigned | Business rule | 404 | "Specification not available" |
| No completed specify job | Business rule | 404 | "Specification not available" |
| Spec file not found | GitHub API | 404 | "Specification file not found" |
| GitHub API error | GitHub API | 500 | "Failed to fetch specification" |
| Test mode | Environment | 200 | Returns mock content |

## Test Data Requirements

### E2E Test Fixtures

**Test Project** (id: 1):
```typescript
{
  id: 1,
  name: '[e2e] Test Project',
  githubOwner: 'test',
  githubRepo: 'test',
}
```

**Test Ticket with Completed Specify Job**:
```typescript
{
  id: 100,
  title: '[e2e] Ticket with Spec',
  branch: 'test-branch-100',
  projectId: 1,
  stage: 'SPECIFY',
  jobs: [
    {
      command: 'specify',
      status: 'COMPLETED',
      ticketId: 100,
    }
  ]
}
```

**Test Ticket without Branch**:
```typescript
{
  id: 101,
  title: '[e2e] Ticket without Branch',
  branch: null,
  projectId: 1,
  stage: 'INBOX',
}
```

**Test Ticket without Completed Job**:
```typescript
{
  id: 102,
  title: '[e2e] Ticket without Completed Job',
  branch: 'test-branch-102',
  projectId: 1,
  stage: 'SPECIFY',
  jobs: [
    {
      command: 'specify',
      status: 'PENDING',
      ticketId: 102,
    }
  ]
}
```

**Mock Spec Content**:
```markdown
# Feature Specification: Test Feature

**Branch**: test-branch-100
**Status**: Draft

## Summary
This is a test specification.

## Requirements
- REQ-1: Test requirement
- REQ-2: Another test requirement

## Code Example
```typescript
const test = 'example';
console.log(test);
```
```

## Performance Considerations

**Database Queries**:
- Single query with `include` (no N+1 problem)
- Indexed on `ticketId`, `projectId`, `status`
- Expected query time: <10ms

**GitHub API**:
- Single file fetch operation
- Expected response time: 100-500ms
- Cached by GitHub CDN for subsequent requests

**Frontend Rendering**:
- react-markdown optimized for performance
- Typical spec size: 5-50KB
- Expected render time: <100ms

---
*Data model complete. No schema migrations required.*
