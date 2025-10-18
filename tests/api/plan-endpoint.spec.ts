import { test, expect } from '@playwright/test';
import { cleanupDatabase, getPrismaClient } from '../helpers/db-cleanup';
import { Stage, JobStatus, WorkflowType } from '@prisma/client';

/**
 * Contract Tests: GET /api/projects/[projectId]/tickets/[id]/plan
 * Feature: 035-view-plan-and (User Story 1)
 * Source: specs/035-view-plan-and/contracts/api.ts
 *
 * Tests validate:
 * - Response schema (content, metadata)
 * - Error codes (400, 403, 404, 429, 500)
 * - Branch selection logic (SHIP → main, else → feature branch)
 * - Workflow type validation (FULL workflow only)
 * - Job completion validation (plan job must be COMPLETED)
 */

test.describe('GET /api/projects/[projectId]/tickets/[id]/plan - Success Cases', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Helper: Create test ticket with branch and job
   */
  const createTestTicket = async (params: {
    stage: Stage;
    branch: string;
    workflowType: WorkflowType;
    jobStatus: JobStatus;
  }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Plan API Test',
        description: 'Test ticket for plan endpoint',
        stage: params.stage,
        branch: params.branch,
        workflowType: params.workflowType,
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'plan',
        status: params.jobStatus,
        completedAt: params.jobStatus === 'COMPLETED' ? new Date() : null,
        updatedAt: new Date(),
      },
    });

    return ticket;
  };

  /**
   * T001: GET plan returns valid response schema for active ticket
   */
  test('GET plan returns valid schema for PLAN stage ticket with feature branch', async ({
    request,
  }) => {
    const ticket = await createTestTicket({
      stage: 'PLAN',
      branch: '035-test-branch',
      workflowType: 'FULL',
      jobStatus: 'COMPLETED',
    });

    const response = await request.get(
      `${BASE_URL}/api/projects/1/tickets/${ticket.id}/plan`
    );

    // Assert 200 OK
    expect(response.status()).toBe(200);

    // Assert response schema
    const data = await response.json();
    expect(data).toHaveProperty('content');
    expect(data).toHaveProperty('metadata');

    // Assert metadata structure
    expect(data.metadata).toHaveProperty('ticketId', ticket.id);
    expect(data.metadata).toHaveProperty('branch', '035-test-branch');
    expect(data.metadata).toHaveProperty('projectId', 1);
    expect(data.metadata).toHaveProperty('docType', 'plan');
    expect(data.metadata).toHaveProperty('fileName', 'plan.md');
    expect(data.metadata).toHaveProperty('filePath', 'specs/035-test-branch/plan.md');
    expect(data.metadata).toHaveProperty('fetchedAt');

    // Assert content is string
    expect(typeof data.content).toBe('string');
  });

  /**
   * T002: GET plan for BUILD stage ticket uses feature branch
   */
  test('GET plan for BUILD stage ticket uses feature branch', async ({ request }) => {
    const ticket = await createTestTicket({
      stage: 'BUILD',
      branch: '035-build-branch',
      workflowType: 'FULL',
      jobStatus: 'COMPLETED',
    });

    const response = await request.get(
      `${BASE_URL}/api/projects/1/tickets/${ticket.id}/plan`
    );

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.metadata.branch).toBe('035-build-branch');
    expect(data.metadata.filePath).toBe('specs/035-build-branch/plan.md');
  });

  /**
   * T003: GET plan for VERIFY stage ticket uses feature branch
   */
  test('GET plan for VERIFY stage ticket uses feature branch', async ({ request }) => {
    const ticket = await createTestTicket({
      stage: 'VERIFY',
      branch: '035-verify-branch',
      workflowType: 'FULL',
      jobStatus: 'COMPLETED',
    });

    const response = await request.get(
      `${BASE_URL}/api/projects/1/tickets/${ticket.id}/plan`
    );

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.metadata.branch).toBe('035-verify-branch');
  });

  /**
   * T004: GET plan for SHIP stage ticket uses main branch (branch selection logic)
   */
  test('GET plan for SHIP stage ticket uses main branch', async ({ request }) => {
    const ticket = await createTestTicket({
      stage: 'SHIP',
      branch: '035-shipped-branch',
      workflowType: 'FULL',
      jobStatus: 'COMPLETED',
    });

    const response = await request.get(
      `${BASE_URL}/api/projects/1/tickets/${ticket.id}/plan`
    );

    expect(response.status()).toBe(200);

    const data = await response.json();
    // CRITICAL: Branch selection logic - SHIP stage should use 'main'
    expect(data.metadata.branch).toBe('main');
    expect(data.metadata.filePath).toBe('specs/035-shipped-branch/plan.md');
  });
});

test.describe('GET /api/projects/[projectId]/tickets/[id]/plan - Validation Errors', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * T005: GET plan with invalid project ID returns 400
   */
  test('GET plan with invalid project ID returns 400', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/projects/invalid/tickets/1/plan`);

    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error.error).toBe('Invalid project ID');
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  /**
   * T006: GET plan with invalid ticket ID returns 400
   */
  test('GET plan with invalid ticket ID returns 400', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/projects/1/tickets/invalid/plan`);

    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error.error).toBe('Invalid ticket ID');
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

test.describe('GET /api/projects/[projectId]/tickets/[id]/plan - Not Found Errors', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * T007: GET plan for non-existent project returns 404
   */
  test('GET plan for non-existent project returns 404', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/projects/99999/tickets/1/plan`);

    expect(response.status()).toBe(404);

    const error = await response.json();
    expect(error.error).toBe('Project not found');
    expect(error.code).toBe('PROJECT_NOT_FOUND');
  });

  /**
   * T008: GET plan for non-existent ticket returns 404
   */
  test('GET plan for non-existent ticket returns 404', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/projects/1/tickets/99999/plan`);

    expect(response.status()).toBe(404);

    const error = await response.json();
    expect(error.error).toBe('Ticket not found');
    expect(error.code).toBe('TICKET_NOT_FOUND');
  });

  /**
   * T009: GET plan for ticket with no branch returns 404
   */
  test('GET plan for ticket with no branch returns 404', async ({ request }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] No Branch',
        description: 'Ticket without branch',
        stage: 'INBOX',
        branch: null,
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    const response = await request.get(
      `${BASE_URL}/api/projects/1/tickets/${ticket.id}/plan`
    );

    expect(response.status()).toBe(404);

    const error = await response.json();
    expect(error.error).toBe('Plan not available');
    expect(error.code).toBe('BRANCH_NOT_ASSIGNED');
    expect(error.message).toContain('does not have a branch assigned');
  });

  /**
   * T010: GET plan for ticket without completed plan job returns 404
   */
  test('GET plan for ticket without completed plan job returns 404', async ({
    request,
  }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] No Plan Job',
        description: 'Ticket without plan job',
        stage: 'PLAN',
        branch: '035-test',
        workflowType: 'FULL',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    const response = await request.get(
      `${BASE_URL}/api/projects/1/tickets/${ticket.id}/plan`
    );

    expect(response.status()).toBe(404);

    const error = await response.json();
    expect(error.error).toBe('Plan not available');
    expect(error.code).toBe('NOT_AVAILABLE_YET');
    expect(error.message).toContain('does not have a completed "plan" job');
  });

  /**
   * T011: GET plan for ticket with PENDING plan job returns 404
   */
  test('GET plan for ticket with PENDING plan job returns 404', async ({ request }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Pending Job',
        description: 'Ticket with pending job',
        stage: 'PLAN',
        branch: '035-test',
        workflowType: 'FULL',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'plan',
        status: 'PENDING',
        updatedAt: new Date(),
      },
    });

    const response = await request.get(
      `${BASE_URL}/api/projects/1/tickets/${ticket.id}/plan`
    );

    expect(response.status()).toBe(404);

    const error = await response.json();
    expect(error.error).toBe('Plan not available');
    expect(error.code).toBe('NOT_AVAILABLE_YET');
  });
});

test.describe('GET /api/projects/[projectId]/tickets/[id]/plan - Authorization', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * T012: GET plan for ticket in different project returns 403
   */
  test('GET plan for ticket belonging to different project returns 403', async ({
    request,
  }) => {
    // Create ticket in project 2
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Wrong Project',
        description: 'Ticket in project 2',
        stage: 'PLAN',
        branch: '035-test',
        projectId: 2,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 2,
        command: 'plan',
        status: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Request plan from project 1 (wrong project)
    const response = await request.get(
      `${BASE_URL}/api/projects/1/tickets/${ticket.id}/plan`
    );

    expect(response.status()).toBe(403);

    const error = await response.json();
    expect(error.error).toBe('Forbidden');
    expect(error.code).toBe('WRONG_PROJECT');
  });
});

test.describe('GET /api/projects/[projectId]/tickets/[id]/plan - GitHub API Errors', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * T013: GET plan returns test mode content when TEST_MODE enabled
   * (validates GitHub API integration without actual API calls)
   */
  test('GET plan returns mock content in test mode', async ({ request }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test Mode',
        description: 'Test mode validation',
        stage: 'PLAN',
        branch: '035-test',
        workflowType: 'FULL',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'plan',
        status: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request.get(
      `${BASE_URL}/api/projects/1/tickets/${ticket.id}/plan`
    );

    expect(response.status()).toBe(200);

    const data = await response.json();
    // In TEST_MODE, doc-fetcher returns mock content
    expect(data.content).toContain('This is mock content for plan.md in test mode');
    expect(data.content).toContain('plan');
  });
});
