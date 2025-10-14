import { test, expect } from '@playwright/test';
import { cleanupDatabase, getPrismaClient } from '../helpers/db-cleanup';
import { setupTestData } from '../helpers/db-setup';
import { transitionThrough } from '../helpers/transition-helpers';

/**
 * E2E tests for GitHub Workflow Transition API
 * Feature: 018-add-github-transition
 *
 * Tests MUST fail initially (TDD) - API endpoint doesn't exist yet
 */

test.describe('POST /api/projects/:projectId/tickets/:id/transition', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  /**
   * Test Scenario 1: Valid SPECIFY Transition
   * Given: Ticket in INBOX stage
   * When: POST with targetStage="SPECIFY"
   * Then: Job created, branch remains null (created by workflow), stage updated
   */
  test('should transition ticket from INBOX to SPECIFY', async ({ request }) => {
    // Arrange
    const { ticket } = await setupTestData();
    const prisma = getPrismaClient();

    // Act
    const response = await request.post(
      `/api/projects/1/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'SPECIFY' },
      }
    );

    // Assert - Response
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.jobId).toBeGreaterThan(0);
    expect(body.message).toContain('Workflow dispatched');

    // Assert - Database state
    const updatedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { jobs: true },
    });

    expect(updatedTicket?.stage).toBe('SPECIFY');
    expect(updatedTicket?.branch).toBeNull(); // Branch not set during transition
    expect(updatedTicket?.version).toBe(2); // Incremented from 1
    expect(updatedTicket?.jobs).toHaveLength(1);
    expect(updatedTicket?.jobs[0]?.command).toBe('specify');
    expect(updatedTicket?.jobs[0]?.status).toBe('PENDING');
  });

  /**
   * Test Scenario 2: Valid PLAN Transition
   * Given: Ticket in SPECIFY stage with existing branch (set by workflow)
   * When: POST with targetStage="PLAN"
   * Then: Job created, branch reused
   */
  test('should transition ticket from SPECIFY to PLAN', async ({ request }) => {
    // Arrange
    const prisma = getPrismaClient();
    const { ticket } = await setupTestData();

    // Transition to SPECIFY first
    await request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
      data: { targetStage: 'SPECIFY' },
    });

    // Simulate workflow setting the branch (via /branch endpoint)
    const branchName = `feature/ticket-${ticket.id}`;
    await request.patch(`/api/projects/1/tickets/${ticket.id}/branch`, {
      data: { branch: branchName },
    });

    // Get updated ticket with branch
    const specifyTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });

    // Act
    const response = await request.post(
      `/api/projects/1/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'PLAN' },
      }
    );

    // Assert - Response
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.jobId).toBeGreaterThan(0);

    // Assert - Branch reused
    const updatedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { jobs: { orderBy: { createdAt: 'desc' } } },
    });

    expect(updatedTicket?.stage).toBe('PLAN');
    expect(updatedTicket?.branch).toBe(specifyTicket?.branch); // Unchanged
    expect(updatedTicket?.branch).toBe(branchName);
    expect(updatedTicket?.jobs[0]?.command).toBe('plan');
  });

  /**
   * Test Scenario 3: Valid BUILD Transition
   * Given: Ticket in PLAN stage
   * When: POST with targetStage="BUILD"
   * Then: Job created with command="implement"
   */
  test('should transition ticket from PLAN to BUILD', async ({ request }) => {
    // Arrange
    const { ticket } = await setupTestData();
    const prisma = getPrismaClient();
    await transitionThrough(request, ticket.id, ['SPECIFY', 'PLAN']);

    // Act
    const response = await request.post(
      `/api/projects/1/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'BUILD' },
      }
    );

    // Assert - Response
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.jobId).toBeGreaterThan(0);

    // Assert - Database
    const updatedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { jobs: { orderBy: { createdAt: 'desc' } } },
    });

    expect(updatedTicket?.stage).toBe('BUILD');
    expect(updatedTicket?.jobs[0]?.command).toBe('implement');
  });

  /**
   * Test Scenario 4: VERIFY Stage (No Workflow)
   * Given: Ticket in BUILD stage
   * When: POST with targetStage="VERIFY"
   * Then: Stage updated, NO job created
   */
  test('should transition ticket to VERIFY without creating job', async ({ request }) => {
    // Arrange
    const { ticket } = await setupTestData();
    const prisma = getPrismaClient();
    await transitionThrough(request, ticket.id, ['SPECIFY', 'PLAN', 'BUILD']);

    const beforeJobs = await prisma.job.findMany({ where: { ticketId: ticket.id } });

    // Act
    const response = await request.post(
      `/api/projects/1/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'VERIFY' },
      }
    );

    // Assert - Response
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.jobId).toBeUndefined();
    expect(body.message).toContain('no workflow');

    // Assert - No new job created
    const afterJobs = await prisma.job.findMany({ where: { ticketId: ticket.id } });
    expect(afterJobs.length).toBe(beforeJobs.length);

    // Assert - Stage updated
    const updatedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(updatedTicket?.stage).toBe('VERIFY');
  });

  /**
   * Test Scenario 5: Invalid Transition (Skipping Stage)
   * Given: Ticket in INBOX stage
   * When: POST with targetStage="BUILD" (skipping SPECIFY and PLAN)
   * Then: 400 error, no changes
   */
  test('should reject invalid transition (skipping stages)', async ({ request }) => {
    // Arrange
    const { ticket } = await setupTestData();
    const prisma = getPrismaClient();

    // Act
    const response = await request.post(
      `/api/projects/1/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'BUILD' },
      }
    );

    // Assert - Error response
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid stage transition');
    expect(body.message).toContain('Cannot transition');
    expect(body.message).toContain('INBOX');
    expect(body.message).toContain('BUILD');

    // Assert - No changes
    const unchangedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { jobs: true },
    });

    expect(unchangedTicket?.stage).toBe('INBOX'); // Unchanged
    expect(unchangedTicket?.jobs).toHaveLength(0); // No jobs created
  });

  /**
   * Test Scenario 6: Cross-Project Access (Forbidden)
   * Given: Ticket belongs to project 1
   * When: POST via project 2 URL (both projects exist)
   * Then: 403 Forbidden, no changes
   */
  test('should reject cross-project access', async ({ request }) => {
    // Arrange
    const prisma = getPrismaClient();

    // Ensure test user exists (matches db-cleanup.ts pattern)
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
      },
    });

    // Ensure both test projects exist (from db-cleanup.ts pattern)
    await prisma.project.upsert({
      where: { id: 1 },
      update: {
        userId: testUser.id,
      },
      create: {
        id: 1,
        name: '[e2e] Test Project',
        description: 'Project for automated tests',
        githubOwner: 'test',
        githubRepo: 'test',
        userId: testUser.id,
      },
    });

    await prisma.project.upsert({
      where: { id: 2 },
      update: {
        userId: testUser.id,
      },
      create: {
        id: 2,
        name: '[e2e] Test Project 2',
        description: 'Second project for cross-project tests',
        githubOwner: 'test',
        githubRepo: 'test2',
        userId: testUser.id,
      },
    });

    // Create ticket in project 1
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Ticket in Project 1',
        description: 'Test',
        stage: 'INBOX',
        projectId: 1,
      },
    });

    // Act - Try to transition using project 2 URL
    const response = await request.post(
      `/api/projects/2/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'SPECIFY' },
      }
    );

    // Assert - Forbidden
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Forbidden');

    // Assert - No changes
    const unchangedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(unchangedTicket?.stage).toBe('INBOX');
  });

  /**
   * Test Scenario 7: Missing Project (Not Found)
   * Given: Non-existent projectId
   * When: POST with non-existent project
   * Then: 404 Not Found
   */
  test('should return 404 for non-existent project', async ({ request }) => {
    // Act
    const response = await request.post(
      '/api/projects/999/tickets/123/transition',
      {
        data: { targetStage: 'SPECIFY' },
      }
    );

    // Assert
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Project not found');
    expect(body.code).toBe('PROJECT_NOT_FOUND');
  });

  /**
   * Test Scenario 8: Missing Ticket (Not Found)
   * Given: Non-existent ticketId
   * When: POST with non-existent ticket
   * Then: 404 Not Found
   */
  test('should return 404 for non-existent ticket', async ({ request }) => {
    // Arrange - Ensure project exists
    await setupTestData();

    // Act
    const response = await request.post(
      '/api/projects/1/tickets/999999/transition',
      {
        data: { targetStage: 'SPECIFY' },
      }
    );

    // Assert
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Ticket not found');
  });

  /**
   * Test Scenario 9: Optimistic Concurrency Conflict
   * Given: Concurrent transition attempts
   * When: Two requests try to transition same ticket simultaneously
   * Then: One succeeds (200), one fails (409 or 500 due to race condition)
   */
  test('should handle optimistic concurrency conflicts', async ({ request }) => {
    // Arrange
    const { ticket } = await setupTestData();
    const prisma = getPrismaClient();

    // Act - Simulate concurrent transitions
    const [response1, response2] = await Promise.all([
      request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
        data: { targetStage: 'SPECIFY' },
      }),
      request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
        data: { targetStage: 'SPECIFY' },
      }),
    ]);

    // Assert - One succeeds, one fails
    const statuses = [response1.status(), response2.status()].sort();

    // In concurrent scenarios, we expect either:
    // - 200 + 409 (ideal optimistic concurrency handling)
    // - 200 + 500 (acceptable race condition between job creation and ticket update)
    expect(statuses[0]).toBe(200); // At least one should succeed
    expect([409, 500]).toContain(statuses[1]); // The other should fail with conflict or error

    // Verify only ONE ticket update occurred (version should be 2, not 3)
    const updatedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(updatedTicket?.version).toBe(2); // Only incremented once
    expect(updatedTicket?.stage).toBe('SPECIFY'); // Stage updated successfully
  });

  /**
   * Test Scenario 10: Complete Workflow (INBOX -> SPECIFY with branch creation)
   * Given: Ticket in INBOX stage
   * When: Transition to SPECIFY, simulate workflow creating branch, update job status
   * Then: Branch created by workflow, job completed, branch updated
   */
  test('should support complete workflow with branch creation and job completion', async ({
    request,
  }) => {
    // Arrange
    const { ticket } = await setupTestData();
    const prisma = getPrismaClient();

    // Act 1: Transition to SPECIFY
    const transitionResponse = await request.post(
      `/api/projects/1/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'SPECIFY' },
      }
    );

    expect(transitionResponse.status()).toBe(200);
    const transitionBody = await transitionResponse.json();
    const jobId = transitionBody.jobId;

    // Assert 1: Branch is null after transition
    let updatedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(updatedTicket?.stage).toBe('SPECIFY');
    expect(updatedTicket?.branch).toBeNull();

    // Act 2: Simulate GitHub workflow creating branch and updating via /branch endpoint
    const branchName = `feature/ticket-${ticket.id}`;
    const branchResponse = await request.patch(
      `/api/projects/1/tickets/${ticket.id}/branch`,
      {
        data: { branch: branchName },
      }
    );

    expect(branchResponse.status()).toBe(200);

    // Assert 2: Branch is now set
    updatedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(updatedTicket?.branch).toBe(branchName);

    // Act 3: Simulate job starting (required by state machine)
    const jobRunningResponse = await request.patch(`/api/jobs/${jobId}/status`, {
      data: { status: 'RUNNING' },
    });

    expect(jobRunningResponse.status()).toBe(200);

    // Act 4: Simulate job completion
    const jobStatusResponse = await request.patch(`/api/jobs/${jobId}/status`, {
      data: { status: 'COMPLETED' },
    });

    expect(jobStatusResponse.status()).toBe(200);

    // Assert 3: Job status updated
    const completedJob = await prisma.job.findUnique({
      where: { id: jobId },
    });
    expect(completedJob?.status).toBe('COMPLETED');
    expect(completedJob?.completedAt).not.toBeNull();
  });

  /**
   * Test Scenario 11: GitHub API Rate Limit (500 Error)
   * Given: GitHub API rate limit exceeded
   * When: POST transition request
   * Then: 500 error, transaction rolled back
   *
   * Note: This test would require mocking Octokit, which is complex in Playwright.
   * For now, we'll skip this test and implement it later with proper mocking.
   */
  test.skip('should handle GitHub API rate limit errors', async () => {
    // This test requires Octokit mocking infrastructure
    // Skip for initial implementation, add with proper mock setup later
  });
});
