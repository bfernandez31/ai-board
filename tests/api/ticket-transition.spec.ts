import { test, expect } from '@playwright/test';
import { cleanupDatabase, getPrismaClient } from '../helpers/db-cleanup';
import { setupTestData } from '../helpers/db-setup';
import { transitionThrough, getLatestJobId } from '../helpers/transition-helpers';

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

    // Assert - Response (API returns full ticket object)
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(ticket.id);
    expect(body.stage).toBe('SPECIFY');
    expect(body.version).toBe(2); // Incremented from 1

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
    const specifyResponse = await request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
      data: { targetStage: 'SPECIFY' },
    });
    const specifyBody = await specifyResponse.json();
    const jobId = await getLatestJobId(request, ticket.id);

    // Complete the SPECIFY job
    const workflowToken = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

    await request.patch(`/api/jobs/${jobId}/status`, {
      data: { status: 'RUNNING' },
      headers: { 'Authorization': `Bearer ${workflowToken}` },
    });

    await request.patch(`/api/jobs/${jobId}/status`, {
      data: { status: 'COMPLETED' },
      headers: { 'Authorization': `Bearer ${workflowToken}` },
    });

    // Simulate workflow setting the branch (via /branch endpoint)
    const branchName = `feature/ticket-${ticket.id}`;

    await request.patch(`/api/projects/1/tickets/${ticket.id}/branch`, {
      data: { branch: branchName },
      headers: {
        'Authorization': `Bearer ${workflowToken}`,
      },
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
    expect(body.id).toBeGreaterThan(0);
    expect(body.stage).toBeDefined();

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

    // Assert - Response (API returns full ticket)
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(ticket.id);
    expect(body.stage).toBe('BUILD');

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
    expect(body.id).toBeGreaterThan(0);
    expect(body.stage).toBe('VERIFY');

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
   * Test Scenario 5: Quick-Impl Transition (INBOX → BUILD)
   * Feature: 031-quick-implementation
   * Given: Ticket in INBOX stage
   * When: POST with targetStage="BUILD" (quick-impl mode)
   * Then: 200 success, job created with command="quick-impl", stage updated to BUILD
   */
  test('should transition ticket from INBOX to BUILD via quick-impl', async ({ request }) => {
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

    // Assert - Response (API returns full ticket)
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(ticket.id);
    expect(body.stage).toBe('BUILD');

    // Assert - Database state
    const updatedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { jobs: true },
    });

    expect(updatedTicket?.stage).toBe('BUILD');
    expect(updatedTicket?.branch).toBeNull(); // Branch not set during transition
    expect(updatedTicket?.version).toBe(2); // Incremented from 1
    expect(updatedTicket?.jobs).toHaveLength(1);
    expect(updatedTicket?.jobs[0]?.command).toBe('quick-impl'); // Quick-impl specific command
    expect(updatedTicket?.jobs[0]?.status).toBe('PENDING');
  });

  /**
   * Test Scenario 5b: Invalid Transition (Skipping Stage - SPECIFY → BUILD)
   * Feature: 031-quick-implementation
   * Given: Ticket in SPECIFY stage
   * When: POST with targetStage="BUILD" (skipping PLAN, not quick-impl)
   * Then: 400 error, no changes
   * Note: INBOX → BUILD is now valid (quick-impl), but SPECIFY → BUILD is not
   */
  test('should reject invalid transition (skipping stages)', async ({ request }) => {
    // Arrange
    const { ticket } = await setupTestData();
    const prisma = getPrismaClient();

    // Complete SPECIFY stage
    await transitionThrough(request, ticket.id, ['SPECIFY']);

    // Act - Try to skip PLAN stage (not quick-impl context)
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
    expect(body.message).toContain('SPECIFY');
    expect(body.message).toContain('BUILD');

    // Assert - No changes (still in SPECIFY)
    const unchangedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { jobs: { orderBy: { createdAt: 'desc' } } },
    });

    expect(unchangedTicket?.stage).toBe('SPECIFY'); // Unchanged
    expect(unchangedTicket?.jobs).toHaveLength(1); // Only SPECIFY job exists
    expect(unchangedTicket?.jobs[0]?.command).toBe('specify');
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
        id: 'test-user-id', // Required: User.id is String (not auto-generated)
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(), // Required: User.updatedAt has no default
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
        updatedAt: new Date(), // Required field
        createdAt: new Date(), // Required field
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
        updatedAt: new Date(), // Required field
        createdAt: new Date(), // Required field
      },
    });

    // Create ticket in project 1
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Ticket in Project 1',
        description: 'Test',
        stage: 'INBOX',
        projectId: 1,
        updatedAt: new Date(), // Required field
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
    // - 200 + 400 (invalid state transition, job validation, or ticket already transitioned)
    // - 200 + 409 (ideal optimistic concurrency handling)
    // - 200 + 500 (acceptable race condition between job creation and ticket update)
    expect(statuses[0]).toBe(200); // At least one should succeed
    expect([400, 409, 500]).toContain(statuses[1]); // The other should fail with conflict or error

    // If one failed with 400, it could be JOB_NOT_COMPLETED or INVALID_TRANSITION
    const failedResponse = response1.status() === 400 ? response1 : response2.status() === 400 ? response2 : null;
    if (failedResponse) {
      const failedBody = await failedResponse.json();
      // Accept either job validation failure or invalid transition
      expect(['JOB_NOT_COMPLETED', 'INVALID_TRANSITION']).toContain(failedBody.code);
    }

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
    const jobId = await getLatestJobId(request, ticket.id);

    // Assert 1: Branch is null after transition
    let updatedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(updatedTicket?.stage).toBe('SPECIFY');
    expect(updatedTicket?.branch).toBeNull();

    // Act 2: Simulate GitHub workflow creating branch and updating via /branch endpoint
    const branchName = `feature/ticket-${ticket.id}`;
    const workflowToken = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

    const branchResponse = await request.patch(
      `/api/projects/1/tickets/${ticket.id}/branch`,
      {
        data: { branch: branchName },
        headers: {
          'Authorization': `Bearer ${workflowToken}`,
        },
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
      headers: {
        'Authorization': `Bearer ${workflowToken}`,
      },
    });

    expect(jobRunningResponse.status()).toBe(200);

    // Act 4: Simulate job completion
    const jobStatusResponse = await request.patch(`/api/jobs/${jobId}/status`, {
      data: { status: 'COMPLETED' },
      headers: {
        'Authorization': `Bearer ${workflowToken}`,
      },
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

  /**
   * Job Completion Validation Tests
   * Feature: 030-should-not-be
   *
   * Tests job validation logic that prevents transitions when workflows are incomplete
   */
  test.describe('Job Completion Validation', () => {
    /**
     * User Story 1: Block transition when job is PENDING
     * Given: Ticket in SPECIFY stage with PENDING job
     * When: Attempt transition to PLAN
     * Then: 400 error with JOB_NOT_COMPLETED code
     */
    test('should block transition when job is PENDING', async ({ request }) => {
      // Arrange
      const { ticket } = await setupTestData();

      // Transition to SPECIFY (creates PENDING job)
      const specifyResponse = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'SPECIFY' } }
      );
      expect(specifyResponse.status()).toBe(200);

      // Act - Attempt transition while job is PENDING
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'PLAN' } }
      );

      // Assert
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('JOB_NOT_COMPLETED');
      expect(body.message).toContain('workflow is still running');
      expect(body.details.jobStatus).toBe('PENDING');
      expect(body.details.currentStage).toBe('SPECIFY');
      expect(body.details.targetStage).toBe('PLAN');
    });

    /**
     * User Story 1: Block transition when job is RUNNING
     * Given: Ticket in SPECIFY stage with RUNNING job
     * When: Attempt transition to PLAN
     * Then: 400 error with message about workflow running
     */
    test('should block transition when job is RUNNING', async ({ request }) => {
      // Arrange
      const { ticket } = await setupTestData();

      // Transition to SPECIFY
      const specifyResponse = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'SPECIFY' } }
      );
      const specifyBody = await specifyResponse.json();
      const jobId = await getLatestJobId(request, ticket.id);

      // Update job to RUNNING
      const workflowToken =
        process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';
      await request.patch(`/api/jobs/${jobId}/status`, {
        data: { status: 'RUNNING' },
        headers: { Authorization: `Bearer ${workflowToken}` },
      });

      // Act - Attempt transition while job is RUNNING
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'PLAN' } }
      );

      // Assert
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('JOB_NOT_COMPLETED');
      expect(body.message).toContain('workflow is still running');
      expect(body.details.jobStatus).toBe('RUNNING');
    });

    /**
     * User Story 1: Block transition when job is FAILED
     * Given: Ticket in SPECIFY stage with FAILED job
     * When: Attempt transition to PLAN
     * Then: 400 error with retry message
     */
    test('should block transition when job is FAILED', async ({ request }) => {
      // Arrange
      const { ticket } = await setupTestData();

      // Transition to SPECIFY
      const specifyResponse = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'SPECIFY' } }
      );
      const specifyBody = await specifyResponse.json();
      const jobId = await getLatestJobId(request, ticket.id);

      // Update job to RUNNING then FAILED
      const workflowToken =
        process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';
      await request.patch(`/api/jobs/${jobId}/status`, {
        data: { status: 'RUNNING' },
        headers: { Authorization: `Bearer ${workflowToken}` },
      });
      await request.patch(`/api/jobs/${jobId}/status`, {
        data: { status: 'FAILED' },
        headers: { Authorization: `Bearer ${workflowToken}` },
      });

      // Act - Attempt transition with FAILED job
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'PLAN' } }
      );

      // Assert
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('JOB_NOT_COMPLETED');
      expect(body.message).toContain('workflow failed');
      expect(body.message).toContain('retry');
      expect(body.details.jobStatus).toBe('FAILED');
    });

    /**
     * User Story 1: Block transition when job is CANCELLED
     * Given: Ticket in SPECIFY stage with CANCELLED job
     * When: Attempt transition to PLAN
     * Then: 400 error with retry message
     */
    test('should block transition when job is CANCELLED', async ({ request }) => {
      // Arrange
      const { ticket } = await setupTestData();

      // Transition to SPECIFY
      const specifyResponse = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'SPECIFY' } }
      );
      const specifyBody = await specifyResponse.json();
      const jobId = await getLatestJobId(request, ticket.id);

      // Update job to RUNNING then CANCELLED
      const workflowToken =
        process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';
      await request.patch(`/api/jobs/${jobId}/status`, {
        data: { status: 'RUNNING' },
        headers: { Authorization: `Bearer ${workflowToken}` },
      });
      await request.patch(`/api/jobs/${jobId}/status`, {
        data: { status: 'CANCELLED' },
        headers: { Authorization: `Bearer ${workflowToken}` },
      });

      // Act - Attempt transition with CANCELLED job
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'PLAN' } }
      );

      // Assert
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('JOB_NOT_COMPLETED');
      expect(body.message).toContain('workflow was cancelled');
      expect(body.message).toContain('retry');
      expect(body.details.jobStatus).toBe('CANCELLED');
    });

    /**
     * User Story 1: Block PLAN→BUILD transition when plan job is PENDING
     * Given: Ticket in PLAN stage with PENDING plan job
     * When: Attempt transition to BUILD
     * Then: 400 error blocking transition
     */
    test('should block PLAN→BUILD transition when plan job is PENDING', async ({ request }) => {
      // Arrange
      const { ticket } = await setupTestData();

      // Complete SPECIFY stage
      await transitionThrough(request, ticket.id, ['SPECIFY']);

      // Transition to PLAN (creates PENDING job)
      const planResponse = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'PLAN' } }
      );
      expect(planResponse.status()).toBe(200);

      // Act - Attempt transition to BUILD while plan job is PENDING
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'BUILD' } }
      );

      // Assert
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('JOB_NOT_COMPLETED');
      expect(body.details.currentStage).toBe('PLAN');
      expect(body.details.targetStage).toBe('BUILD');
      expect(body.details.jobStatus).toBe('PENDING');
    });

    /**
     * User Story 1: Block BUILD→VERIFY transition when build job is RUNNING
     * Given: Ticket in BUILD stage with RUNNING build job
     * When: Attempt transition to VERIFY
     * Then: 400 error blocking transition
     */
    test('should block BUILD→VERIFY transition when build job is RUNNING', async ({ request }) => {
      // Arrange
      const { ticket } = await setupTestData();

      // Complete SPECIFY and PLAN stages
      await transitionThrough(request, ticket.id, ['SPECIFY', 'PLAN']);

      // Transition to BUILD
      const buildResponse = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'BUILD' } }
      );
      const buildBody = await buildResponse.json();
      const jobId = await getLatestJobId(request, ticket.id);

      // Update job to RUNNING
      const workflowToken =
        process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';
      await request.patch(`/api/jobs/${jobId}/status`, {
        data: { status: 'RUNNING' },
        headers: { Authorization: `Bearer ${workflowToken}` },
      });

      // Act - Attempt transition to VERIFY while build job is RUNNING
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'VERIFY' } }
      );

      // Assert
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('JOB_NOT_COMPLETED');
      expect(body.details.currentStage).toBe('BUILD');
      expect(body.details.targetStage).toBe('VERIFY');
      expect(body.details.jobStatus).toBe('RUNNING');
    });

    /**
     * User Story 2: Allow transition when job is COMPLETED
     * Given: Ticket in SPECIFY stage with COMPLETED job
     * When: Attempt transition to PLAN
     * Then: 200 success, new job created
     */
    test('should allow transition when job is COMPLETED', async ({ request }) => {
      // Arrange
      const prisma = getPrismaClient();
      const { ticket } = await setupTestData();

      // Transition to SPECIFY and complete the job
      await transitionThrough(request, ticket.id, ['SPECIFY']);

      // Act - Transition to PLAN with COMPLETED job
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'PLAN' } }
      );

      // Assert - Success response
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.id).toBeGreaterThan(0);
      expect(body.stage).toBeDefined();

      // Assert - Ticket updated and new job created
      const updatedTicket = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        include: { jobs: { orderBy: { createdAt: 'desc' } } },
      });
      expect(updatedTicket?.stage).toBe('PLAN');
      expect(updatedTicket?.jobs[0]?.command).toBe('plan');
      expect(updatedTicket?.jobs[0]?.status).toBe('PENDING');
    });

    /**
     * User Story 2: Allow PLAN→BUILD transition when plan job is COMPLETED
     * Given: Ticket in PLAN stage with COMPLETED plan job
     * When: Attempt transition to BUILD
     * Then: 200 success, build job created
     */
    test('should allow PLAN→BUILD transition when plan job is COMPLETED', async ({ request }) => {
      // Arrange
      const prisma = getPrismaClient();
      const { ticket } = await setupTestData();

      // Complete SPECIFY and PLAN stages
      await transitionThrough(request, ticket.id, ['SPECIFY', 'PLAN']);

      // Act - Transition to BUILD with COMPLETED plan job
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'BUILD' } }
      );

      // Assert
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.id).toBeGreaterThan(0);
      expect(body.stage).toBeDefined();

      // Assert - Build stage and new job
      const updatedTicket = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        include: { jobs: { orderBy: { createdAt: 'desc' } } },
      });
      expect(updatedTicket?.stage).toBe('BUILD');
      expect(updatedTicket?.jobs[0]?.command).toBe('implement');
    });

    /**
     * User Story 2: Allow BUILD→VERIFY transition when build job is COMPLETED
     * Given: Ticket in BUILD stage with COMPLETED build job
     * When: Attempt transition to VERIFY
     * Then: 200 success, no new job (manual stage)
     */
    test('should allow BUILD→VERIFY transition when build job is COMPLETED', async ({ request }) => {
      // Arrange
      const prisma = getPrismaClient();
      const { ticket } = await setupTestData();

      // Complete SPECIFY, PLAN, and BUILD stages
      await transitionThrough(request, ticket.id, ['SPECIFY', 'PLAN', 'BUILD']);

      // Act - Transition to VERIFY with COMPLETED build job
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'VERIFY' } }
      );

      // Assert
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.id).toBeGreaterThan(0);
      expect(body.stage).toBe('VERIFY');

      // Assert - VERIFY stage reached
      const updatedTicket = await prisma.ticket.findUnique({
        where: { id: ticket.id },
      });
      expect(updatedTicket?.stage).toBe('VERIFY');
    });

    /**
     * User Story 3: Allow INBOX→SPECIFY transition without job validation
     * Given: Ticket in INBOX stage (no prior jobs)
     * When: Attempt transition to SPECIFY
     * Then: 200 success, no job validation performed
     */
    test('should allow INBOX→SPECIFY transition without job validation', async ({ request }) => {
      // Arrange
      const { ticket } = await setupTestData();

      // Act - Transition from INBOX to SPECIFY (no prior jobs to validate)
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'SPECIFY' } }
      );

      // Assert
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.id).toBeGreaterThan(0);
      expect(body.stage).toBeDefined();
    });

    /**
     * User Story 4: Validate against most recent job (COMPLETED after FAILED)
     * Given: Ticket with old FAILED job and new COMPLETED job
     * When: Attempt transition
     * Then: 200 success (validates against most recent COMPLETED job)
     */
    test('should validate against most recent job (COMPLETED after FAILED)', async ({ request }) => {
      // Arrange
      const prisma = getPrismaClient();
      const { ticket } = await setupTestData();

      // Create first job (FAILED)
      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: 1,
          command: 'specify',
          status: 'FAILED',
          startedAt: new Date(Date.now() - 10000), // 10 seconds ago
          completedAt: new Date(Date.now() - 9000),
          updatedAt: new Date(Date.now() - 10000),
        },
      });

      // Update ticket to SPECIFY stage
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { stage: 'SPECIFY', version: { increment: 1 } },
      });

      // Create second job (COMPLETED) - most recent
      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: 1,
          command: 'specify',
          status: 'COMPLETED',
          startedAt: new Date(), // Now (most recent)
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Act - Transition to PLAN (should validate against most recent COMPLETED job)
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'PLAN' } }
      );

      // Assert
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.id).toBeGreaterThan(0);
      expect(body.stage).toBeDefined();
    });

    /**
     * User Story 4: Validate against most recent job (FAILED after COMPLETED)
     * Given: Ticket with old COMPLETED job and new FAILED job
     * When: Attempt transition
     * Then: 400 error (validates against most recent FAILED job)
     */
    test('should validate against most recent job (FAILED after COMPLETED)', async ({ request }) => {
      // Arrange
      const prisma = getPrismaClient();
      const { ticket } = await setupTestData();

      // Create first job (COMPLETED)
      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: 1,
          command: 'specify',
          status: 'COMPLETED',
          startedAt: new Date(Date.now() - 10000), // 10 seconds ago
          completedAt: new Date(Date.now() - 9000),
          updatedAt: new Date(Date.now() - 10000),
        },
      });

      // Update ticket to SPECIFY stage
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { stage: 'SPECIFY', version: { increment: 1 } },
      });

      // Create second job (FAILED) - most recent
      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: 1,
          command: 'specify',
          status: 'FAILED',
          startedAt: new Date(), // Now (most recent)
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Act - Transition to PLAN (should validate against most recent FAILED job)
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'PLAN' } }
      );

      // Assert
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('JOB_NOT_COMPLETED');
      expect(body.message).toContain('workflow failed');
      expect(body.details.jobStatus).toBe('FAILED');
    });

    /**
     * User Story 4: Validate against most recent job with three jobs
     * Given: Ticket with FAILED, COMPLETED, and RUNNING jobs
     * When: Attempt transition
     * Then: 400 error (validates against most recent RUNNING job)
     */
    test('should validate against most recent job with three jobs (FAILED, COMPLETED, RUNNING)', async ({ request }) => {
      // Arrange
      const prisma = getPrismaClient();
      const { ticket } = await setupTestData();

      // Create first job (FAILED)
      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: 1,
          command: 'specify',
          status: 'FAILED',
          startedAt: new Date(Date.now() - 20000), // 20 seconds ago
          completedAt: new Date(Date.now() - 19000),
          updatedAt: new Date(Date.now() - 20000),
        },
      });

      // Update ticket to SPECIFY stage
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { stage: 'SPECIFY', version: { increment: 1 } },
      });

      // Create second job (COMPLETED)
      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: 1,
          command: 'specify',
          status: 'COMPLETED',
          startedAt: new Date(Date.now() - 10000), // 10 seconds ago
          completedAt: new Date(Date.now() - 9000),
          updatedAt: new Date(Date.now() - 10000),
        },
      });

      // Create third job (RUNNING) - most recent
      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: 1,
          command: 'specify',
          status: 'RUNNING',
          startedAt: new Date(), // Now (most recent)
          updatedAt: new Date(),
        },
      });

      // Act - Transition to PLAN (should validate against most recent RUNNING job)
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'PLAN' } }
      );

      // Assert
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('JOB_NOT_COMPLETED');
      expect(body.message).toContain('workflow is still running');
      expect(body.details.jobStatus).toBe('RUNNING');
    });
  });

  /**
   * WorkflowType Field Tests
   * Feature: 032-add-workflow-type
   *
   * Tests workflowType field behavior during transitions
   */
  test.describe('WorkflowType Field', () => {
    /**
     * Test: INBOX → BUILD sets workflowType to QUICK
     * Given: Ticket in INBOX stage
     * When: Transition directly to BUILD (quick-impl)
     * Then: workflowType set to QUICK atomically with Job creation
     */
    test('should set workflowType to QUICK for quick-impl transition', async ({ request }) => {
      // Arrange
      const { ticket } = await setupTestData();
      const prisma = getPrismaClient();

      // Act - Quick-impl transition (INBOX → BUILD)
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'BUILD' } }
      );

      // Assert - Response success
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.id).toBeGreaterThan(0);
      expect(body.stage).toBeDefined();

      // Assert - Database state
      const updatedTicket = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { workflowType: true, stage: true },
      });

      expect(updatedTicket?.stage).toBe('BUILD');
      expect(updatedTicket?.workflowType).toBe('QUICK');
    });

    /**
     * Test: INBOX → SPECIFY preserves workflowType FULL
     * Given: Ticket in INBOX stage
     * When: Transition to SPECIFY (normal workflow)
     * Then: workflowType remains FULL (default value)
     */
    test('should preserve workflowType FULL for normal workflow', async ({ request }) => {
      // Arrange
      const { ticket } = await setupTestData();
      const prisma = getPrismaClient();

      // Act - Normal workflow transition (INBOX → SPECIFY)
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'SPECIFY' } }
      );

      // Assert - Response success
      expect(response.status()).toBe(200);

      // Assert - Database state
      const updatedTicket = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { workflowType: true, stage: true },
      });

      expect(updatedTicket?.stage).toBe('SPECIFY');
      expect(updatedTicket?.workflowType).toBe('FULL');
    });

    /**
     * Test: workflowType immutable after setting to QUICK
     * Given: Ticket with workflowType=QUICK in BUILD stage
     * When: Transition to VERIFY
     * Then: workflowType remains QUICK (immutable)
     */
    test('should keep workflowType QUICK after subsequent transitions', async ({ request }) => {
      // Arrange
      const { ticket } = await setupTestData();
      const prisma = getPrismaClient();

      // Quick-impl transition (INBOX → BUILD, sets workflowType=QUICK)
      await request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
        data: { targetStage: 'BUILD' },
      });

      // Complete the BUILD job
      const buildTicket = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        include: { jobs: { orderBy: { createdAt: 'desc' } } },
      });
      const buildJobId = buildTicket?.jobs[0]?.id;

      const workflowToken =
        process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';
      await request.patch(`/api/jobs/${buildJobId}/status`, {
        data: { status: 'RUNNING' },
        headers: { Authorization: `Bearer ${workflowToken}` },
      });
      await request.patch(`/api/jobs/${buildJobId}/status`, {
        data: { status: 'COMPLETED' },
        headers: { Authorization: `Bearer ${workflowToken}` },
      });

      // Act - Transition to VERIFY (should NOT change workflowType)
      const response = await request.post(
        `/api/projects/1/tickets/${ticket.id}/transition`,
        { data: { targetStage: 'VERIFY' } }
      );

      // Assert - Response success
      expect(response.status()).toBe(200);

      // Assert - workflowType unchanged
      const verifyTicket = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { workflowType: true, stage: true },
      });

      expect(verifyTicket?.stage).toBe('VERIFY');
      expect(verifyTicket?.workflowType).toBe('QUICK'); // Still QUICK
    });
  });
});
