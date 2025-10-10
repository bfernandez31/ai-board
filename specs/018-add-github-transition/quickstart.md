# Quickstart: GitHub Workflow Transition API

**Feature**: 018-add-github-transition
**Date**: 2025-10-09

## Purpose

This document provides end-to-end test scenarios for the GitHub workflow transition API. These scenarios should be implemented as Playwright tests BEFORE implementing the API endpoint (Test-Driven Development).

---

## Prerequisites

**Environment Setup**:
```bash
# 1. Install dependencies
npm install @octokit/rest

# 2. Configure environment variables
echo "GITHUB_TOKEN=ghp_YOUR_TOKEN_HERE" >> .env.local

# 3. Ensure test database is running
npm run db:test:up

# 4. Run Prisma migrations
npx prisma migrate deploy
```

**Test Data Setup**:
```typescript
// tests/helpers/db-setup.ts
import { PrismaClient } from '@prisma/client';

export async function setupTestData() {
  const prisma = new PrismaClient();

  // Create test project
  const project = await prisma.project.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: '[e2e] Test Project',
      description: 'Test project for transition API',
      githubOwner: 'test-owner',
      githubRepo: 'test-repo'
    }
  });

  // Create test ticket in INBOX stage
  const ticket = await prisma.ticket.create({
    data: {
      title: '[e2e] Test Ticket',
      description: 'Test ticket for transition API',
      stage: 'INBOX',
      projectId: project.id
    }
  });

  await prisma.$disconnect();
  return { project, ticket };
}
```

---

## Test Scenario 1: Valid SPECIFY Transition

**Given**: Ticket in INBOX stage with valid title and description
**When**: POST `/api/projects/1/tickets/{id}/transition` with `{targetStage: "SPECIFY"}`
**Then**:
- Response 200 OK
- Response body contains `{ success: true, jobId: number, message: string }`
- Job record created with command="specify", status=PENDING
- Ticket stage updated to SPECIFY
- Ticket branch populated as `feature/ticket-{id}`
- Ticket version incremented
- (Mock) GitHub Actions workflow dispatched with correct inputs

**Playwright Test**:
```typescript
test('should transition ticket from INBOX to SPECIFY', async ({ request }) => {
  // Arrange
  const { ticket } = await setupTestData();

  // Act
  const response = await request.post(
    `/api/projects/1/tickets/${ticket.id}/transition`,
    {
      data: { targetStage: 'SPECIFY' }
    }
  );

  // Assert
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.success).toBe(true);
  expect(body.jobId).toBeGreaterThan(0);
  expect(body.message).toContain('Workflow dispatched');

  // Verify database state
  const prisma = new PrismaClient();
  const updatedTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: { jobs: true }
  });

  expect(updatedTicket.stage).toBe('SPECIFY');
  expect(updatedTicket.branch).toBe(`feature/ticket-${ticket.id}`);
  expect(updatedTicket.version).toBe(2); // Incremented from 1
  expect(updatedTicket.jobs).toHaveLength(1);
  expect(updatedTicket.jobs[0].command).toBe('specify');
  expect(updatedTicket.jobs[0].status).toBe('PENDING');

  await prisma.$disconnect();
});
```

---

## Test Scenario 2: Valid PLAN Transition

**Given**: Ticket in SPECIFY stage with existing branch
**When**: POST `/api/projects/1/tickets/{id}/transition` with `{targetStage: "PLAN"}`
**Then**:
- Response 200 OK
- Job record created with command="plan"
- Ticket stage updated to PLAN
- Ticket branch unchanged (reuses existing branch)
- Workflow dispatched with existing branch name

**Playwright Test**:
```typescript
test('should transition ticket from SPECIFY to PLAN', async ({ request }) => {
  // Arrange
  const prisma = new PrismaClient();
  const { ticket } = await setupTestData();

  // Transition to SPECIFY first
  await request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
    data: { targetStage: 'SPECIFY' }
  });

  // Get updated ticket with branch
  const specifyTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id }
  });

  // Act
  const response = await request.post(
    `/api/projects/1/tickets/${ticket.id}/transition`,
    {
      data: { targetStage: 'PLAN' }
    }
  );

  // Assert
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.success).toBe(true);
  expect(body.jobId).toBeGreaterThan(0);

  // Verify branch reused
  const updatedTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: { jobs: { orderBy: { createdAt: 'desc' } } }
  });

  expect(updatedTicket.stage).toBe('PLAN');
  expect(updatedTicket.branch).toBe(specifyTicket.branch); // Unchanged
  expect(updatedTicket.jobs[0].command).toBe('plan');

  await prisma.$disconnect();
});
```

---

## Test Scenario 3: Valid BUILD Transition

**Given**: Ticket in PLAN stage
**When**: POST `/api/projects/1/tickets/{id}/transition` with `{targetStage: "BUILD"}`
**Then**:
- Response 200 OK
- Job record created with command="implement"
- Ticket stage updated to BUILD

**Playwright Test**:
```typescript
test('should transition ticket from PLAN to BUILD', async ({ request }) => {
  // Arrange
  const { ticket } = await setupTestData();
  await transitionThrough(request, ticket.id, ['SPECIFY', 'PLAN']);

  // Act
  const response = await request.post(
    `/api/projects/1/tickets/${ticket.id}/transition`,
    {
      data: { targetStage: 'BUILD' }
    }
  );

  // Assert
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.jobId).toBeGreaterThan(0);

  const prisma = new PrismaClient();
  const updatedTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: { jobs: { orderBy: { createdAt: 'desc' } } }
  });

  expect(updatedTicket.stage).toBe('BUILD');
  expect(updatedTicket.jobs[0].command).toBe('implement');

  await prisma.$disconnect();
});
```

---

## Test Scenario 4: VERIFY Stage (No Workflow)

**Given**: Ticket in BUILD stage
**When**: POST `/api/projects/1/tickets/{id}/transition` with `{targetStage: "VERIFY"}`
**Then**:
- Response 200 OK
- Response body `{ success: true, message: "Stage updated (no workflow for VERIFY/SHIP)" }`
- NO job record created
- Ticket stage updated to VERIFY
- NO workflow dispatched

**Playwright Test**:
```typescript
test('should transition ticket to VERIFY without creating job', async ({ request }) => {
  // Arrange
  const { ticket } = await setupTestData();
  await transitionThrough(request, ticket.id, ['SPECIFY', 'PLAN', 'BUILD']);

  const prisma = new PrismaClient();
  const beforeJobs = await prisma.job.findMany({ where: { ticketId: ticket.id } });

  // Act
  const response = await request.post(
    `/api/projects/1/tickets/${ticket.id}/transition`,
    {
      data: { targetStage: 'VERIFY' }
    }
  );

  // Assert
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.success).toBe(true);
  expect(body.jobId).toBeUndefined();
  expect(body.message).toContain('no workflow');

  const afterJobs = await prisma.job.findMany({ where: { ticketId: ticket.id } });
  expect(afterJobs.length).toBe(beforeJobs.length); // No new job

  const updatedTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id }
  });
  expect(updatedTicket.stage).toBe('VERIFY');

  await prisma.$disconnect();
});
```

---

## Test Scenario 5: Invalid Transition (Skipping Stage)

**Given**: Ticket in INBOX stage
**When**: POST `/api/projects/1/tickets/{id}/transition` with `{targetStage: "BUILD"}` (skipping SPECIFY and PLAN)
**Then**:
- Response 400 Bad Request
- Error message: "Invalid stage transition"
- Ticket stage unchanged
- No job record created

**Playwright Test**:
```typescript
test('should reject invalid transition (skipping stages)', async ({ request }) => {
  // Arrange
  const { ticket } = await setupTestData();

  // Act
  const response = await request.post(
    `/api/projects/1/tickets/${ticket.id}/transition`,
    {
      data: { targetStage: 'BUILD' }
    }
  );

  // Assert
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toBe('Invalid stage transition');
  expect(body.message).toContain('cannot transition');
  expect(body.message).toContain('INBOX');
  expect(body.message).toContain('BUILD');

  // Verify no changes
  const prisma = new PrismaClient();
  const unchangedTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: { jobs: true }
  });

  expect(unchangedTicket.stage).toBe('INBOX'); // Unchanged
  expect(unchangedTicket.jobs).toHaveLength(0); // No jobs created

  await prisma.$disconnect();
});
```

---

## Test Scenario 6: Cross-Project Access (Forbidden)

**Given**: Ticket belongs to project ID 1
**When**: POST `/api/projects/2/tickets/{id}/transition` (different projectId in URL)
**Then**:
- Response 403 Forbidden
- Error: "Forbidden"
- Ticket unchanged
- No job created
- No workflow dispatched

**Playwright Test**:
```typescript
test('should reject cross-project access', async ({ request }) => {
  // Arrange
  const prisma = new PrismaClient();
  const project1 = await prisma.project.create({
    data: {
      name: '[e2e] Project 1',
      description: 'Test',
      githubOwner: 'owner1',
      githubRepo: 'repo1'
    }
  });

  const ticket = await prisma.ticket.create({
    data: {
      title: '[e2e] Ticket in Project 1',
      description: 'Test',
      stage: 'INBOX',
      projectId: project1.id
    }
  });

  // Act - Try to transition using wrong projectId
  const response = await request.post(
    `/api/projects/999/tickets/${ticket.id}/transition`,
    {
      data: { targetStage: 'SPECIFY' }
    }
  );

  // Assert
  expect(response.status()).toBe(403);
  const body = await response.json();
  expect(body.error).toBe('Forbidden');

  // Verify no changes
  const unchangedTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id }
  });
  expect(unchangedTicket.stage).toBe('INBOX');

  await prisma.$disconnect();
});
```

---

## Test Scenario 7: Missing Project (Not Found)

**Given**: Non-existent projectId
**When**: POST `/api/projects/999/tickets/123/transition`
**Then**:
- Response 404 Not Found
- Error: "Project not found"

**Playwright Test**:
```typescript
test('should return 404 for non-existent project', async ({ request }) => {
  // Act
  const response = await request.post(
    '/api/projects/999/tickets/123/transition',
    {
      data: { targetStage: 'SPECIFY' }
    }
  );

  // Assert
  expect(response.status()).toBe(404);
  const body = await response.json();
  expect(body.error).toBe('Project not found');
  expect(body.code).toBe('PROJECT_NOT_FOUND');
});
```

---

## Test Scenario 8: Missing Ticket (Not Found)

**Given**: Non-existent ticketId
**When**: POST `/api/projects/1/tickets/999/transition`
**Then**:
- Response 404 Not Found
- Error: "Ticket not found"

**Playwright Test**:
```typescript
test('should return 404 for non-existent ticket', async ({ request }) => {
  // Arrange
  await setupTestData(); // Ensure project exists

  // Act
  const response = await request.post(
    '/api/projects/1/tickets/999999/transition',
    {
      data: { targetStage: 'SPECIFY' }
    }
  );

  // Assert
  expect(response.status()).toBe(404);
  const body = await response.json();
  expect(body.error).toBe('Ticket not found');
});
```

---

## Test Scenario 9: Optimistic Concurrency Conflict

**Given**: Ticket modified by another user (version mismatch)
**When**: Concurrent transition attempts
**Then**:
- First request succeeds (200 OK)
- Second request fails (409 Conflict)
- Error includes currentVersion

**Playwright Test**:
```typescript
test('should handle optimistic concurrency conflicts', async ({ request }) => {
  // Arrange
  const { ticket } = await setupTestData();

  // Act - Simulate concurrent transitions
  const [response1, response2] = await Promise.all([
    request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
      data: { targetStage: 'SPECIFY' }
    }),
    request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
      data: { targetStage: 'SPECIFY' }
    })
  ]);

  // Assert - One succeeds, one fails
  const statuses = [response1.status(), response2.status()].sort();
  expect(statuses).toEqual([200, 409]);

  const conflictResponse = response1.status() === 409 ? response1 : response2;
  const conflictBody = await conflictResponse.json();
  expect(conflictBody.error).toContain('modified by another user');
  expect(conflictBody.currentVersion).toBeGreaterThan(1);
});
```

---

## Test Scenario 10: GitHub API Rate Limit (500 Error)

**Given**: GitHub API rate limit exceeded
**When**: POST transition request
**Then**:
- Response 500 Internal Server Error
- Error message indicates rate limit
- Ticket unchanged
- Job not created (transaction rolled back)

**Playwright Test**:
```typescript
test('should handle GitHub API rate limit errors', async ({ request }) => {
  // Arrange
  const { ticket } = await setupTestData();

  // Mock Octokit to throw rate limit error
  // (requires test harness to intercept Octokit calls)

  // Act
  const response = await request.post(
    `/api/projects/1/tickets/${ticket.id}/transition`,
    {
      data: { targetStage: 'SPECIFY' }
    }
  );

  // Assert
  expect(response.status()).toBe(500);
  const body = await response.json();
  expect(body.error).toContain('GitHub');
  expect(body.code).toBe('GITHUB_ERROR');

  // Verify rollback
  const prisma = new PrismaClient();
  const unchangedTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: { jobs: true }
  });

  expect(unchangedTicket.stage).toBe('INBOX'); // Unchanged
  expect(unchangedTicket.jobs).toHaveLength(0); // No jobs

  await prisma.$disconnect();
});
```

---

## Helper Functions

```typescript
// tests/helpers/transition-helpers.ts

export async function transitionThrough(
  request: APIRequestContext,
  ticketId: number,
  stages: string[]
): Promise<void> {
  for (const stage of stages) {
    await request.post(`/api/projects/1/tickets/${ticketId}/transition`, {
      data: { targetStage: stage }
    });
  }
}

export async function cleanupTestData() {
  const prisma = new PrismaClient();
  await prisma.job.deleteMany({ where: { ticket: { title: { startsWith: '[e2e]' } } } });
  await prisma.ticket.deleteMany({ where: { title: { startsWith: '[e2e]' } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: '[e2e]' } } });
  await prisma.$disconnect();
}
```

---

## Running Tests

```bash
# Run all transition API tests
npx playwright test tests/018-transition-api.spec.ts

# Run with UI mode
npx playwright test tests/018-transition-api.spec.ts --ui

# Run single scenario
npx playwright test tests/018-transition-api.spec.ts -g "should transition ticket from INBOX to SPECIFY"

# Debug mode
npx playwright test tests/018-transition-api.spec.ts --debug
```

---

## Test Coverage Checklist

- [x] Scenario 1: Valid SPECIFY transition (job created, branch generated)
- [x] Scenario 2: Valid PLAN transition (job created, branch reused)
- [x] Scenario 3: Valid BUILD transition (job created, command="implement")
- [x] Scenario 4: VERIFY stage (no job, no workflow)
- [x] Scenario 5: Invalid transition (400 error, no changes)
- [x] Scenario 6: Cross-project access (403 Forbidden)
- [x] Scenario 7: Missing project (404 Not Found)
- [x] Scenario 8: Missing ticket (404 Not Found)
- [x] Scenario 9: Optimistic concurrency conflict (409 Conflict)
- [x] Scenario 10: GitHub API rate limit (500 Error, transaction rollback)

**Total**: 10 test scenarios covering all success paths, validation errors, authorization, and error handling.

---

**Status**: ✅ Quickstart complete - All E2E test scenarios defined
**Next**: Implement Playwright test file (`tests/018-transition-api.spec.ts`) following TDD principles
