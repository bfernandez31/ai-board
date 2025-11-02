import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase, getPrismaClient } from '../helpers/db-cleanup';
import { Stage } from '@prisma/client';

/**
 * Contract Tests: POST /api/projects/[projectId]/docs
 * Feature: 036-mode-to-update (User Story 1)
 * Source: specs/036-mode-to-update/contracts/api-contract.md
 *
 * Tests validate:
 * - Response schema (success, commitSha, updatedAt, message)
 * - Error codes (400, 403, 404, 409, 500)
 * - Stage-based permissions (SPECIFY → spec only, PLAN → plan/tasks only)
 * - Request validation (Zod schema)
 * - GitHub API interaction (mocked to avoid real API calls)
 *
 * NOTE: GitHub API calls are mocked in these tests to avoid:
 * - Real API costs
 * - GitHub rate limits
 * - Network dependencies
 * - Requiring valid GITHUB_TOKEN
 */

test.describe('POST /api/projects/[projectId]/docs - Success Cases', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    ticketCounter = 0;
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Helper: Create test ticket with branch
   */
  let ticketCounter = 0;
  const createTestTicket = async (
    projectId: number,
    params: {
      stage: Stage;
      branch: string;
      title?: string;
    }
  ) => {
    ticketCounter++;
    return await prisma.ticket.create({
      data: {
        ticketNumber: ticketCounter,
        ticketKey: `E2E${projectId}-${ticketCounter}`,
        title: params.title || '[e2e] Doc Edit Test',
        description: 'Test ticket for documentation editing',
        stage: params.stage,
        branch: params.branch,
        projectId,
        updatedAt: new Date(),
      },
    });
  };

  /**
   * T014: POST /api/projects/:id/docs returns 200 with valid request for spec.md
   */
  test('POST docs returns 200 for spec.md edit in SPECIFY stage', async ({ request, projectId }) => {
    // Setup: Create ticket in SPECIFY stage
    const ticket = await createTestTicket(projectId, {
      stage: 'SPECIFY',
      branch: '036-test-branch',
    });

    // Mock request body
    const requestBody = {
      ticketId: ticket.id,
      docType: 'spec',
      content: '# Updated Spec\n\nNew content for testing',
      commitMessage: 'docs: update spec for testing',
    };

    // NOTE: GitHub API is mocked in test environment (TEST_MODE=true)
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/docs`, {
      data: requestBody,
    });

    // Assert response (mocked GitHub API always succeeds in test mode)
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('commitSha');
    expect(data).toHaveProperty('updatedAt');
    expect(data).toHaveProperty('message');
    expect(data.commitSha).toMatch(/^mock-sha-/); // Mock SHA format
    expect(data.message).toContain('spec.md');
  });

  /**
   * T014: Verify response schema structure
   */
  test('POST docs response matches schema', async ({ request, projectId }) => {
    const ticket = await createTestTicket(projectId, {
      stage: 'SPECIFY',
      branch: '036-schema-test',
    });

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/docs`, {
      data: {
        ticketId: ticket.id,
        docType: 'spec',
        content: '# Test\n\nSchema validation',
      },
    });

    const data = await response.json();

    // Verify all required fields exist
    expect(data).toHaveProperty('success');
    if (data.success) {
      expect(data).toHaveProperty('commitSha');
      expect(data).toHaveProperty('updatedAt');
      expect(data).toHaveProperty('message');
      expect(typeof data.commitSha).toBe('string');
      expect(typeof data.updatedAt).toBe('string');
      expect(typeof data.message).toBe('string');
    } else {
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    }
  });
});

test.describe('POST /api/projects/[projectId]/docs - Permission Errors (403)', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * T015: Permission denied - trying to edit spec.md when NOT in SPECIFY stage
   */
  test('POST docs returns 403 PERMISSION_DENIED for spec in PLAN stage', async ({ request, projectId }) => {
    // Setup: Ticket in PLAN stage (spec editing not allowed)
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] Permission Test',
        description: 'Test permission denial',
        stage: 'PLAN', // Wrong stage for spec editing
        branch: '036-permission-test',
        projectId,
        updatedAt: new Date(),
      },
    });

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/docs`, {
      data: {
        ticketId: ticket.id,
        docType: 'spec', // Not allowed in PLAN stage
        content: '# Should Fail\n\nThis should not be allowed',
      },
    });

    // Assert 403 Forbidden
    expect(response.status()).toBe(403);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('PERMISSION_DENIED');
    expect(data.error).toContain('spec.md');
    expect(data.error).toContain('PLAN');
  });

  /**
   * T015: Permission denied - trying to edit plan.md when in SPECIFY stage
   */
  test('POST docs returns 403 for plan.md edit in SPECIFY stage', async ({ request, projectId }) => {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 2,
        ticketKey: `E2E${projectId}-2`,
        title: '[e2e] Plan Permission Test',
        description: 'Test plan editing permission',
        stage: 'SPECIFY', // Wrong stage for plan editing
        branch: '036-plan-test',
        projectId,
        updatedAt: new Date(),
      },
    });

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/docs`, {
      data: {
        ticketId: ticket.id,
        docType: 'plan', // Not allowed in SPECIFY stage
        content: '# Plan\n\nShould fail',
      },
    });

    expect(response.status()).toBe(403);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('PERMISSION_DENIED');
    expect(data.error).toContain('plan.md');
    expect(data.error).toContain('SPECIFY');
  });

  /**
   * T015: Permission denied - no editing allowed in BUILD stage
   */
  test('POST docs returns 403 for any doc type in BUILD stage', async ({ request, projectId }) => {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 3,
        ticketKey: `E2E${projectId}-3`,
        title: '[e2e] BUILD Stage Test',
        description: 'No editing in BUILD',
        stage: 'BUILD', // No editing allowed
        branch: '036-build-test',
        projectId,
        updatedAt: new Date(),
      },
    });

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/docs`, {
      data: {
        ticketId: ticket.id,
        docType: 'spec',
        content: '# Spec\n\nShould fail',
      },
    });

    expect(response.status()).toBe(403);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('PERMISSION_DENIED');
  });
});

test.describe('POST /api/projects/[projectId]/docs - Validation Errors (400)', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Validation error - missing required fields
   */
  test('POST docs returns 400 for missing ticketId', async ({ request, projectId }) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/docs`, {
      data: {
        // Missing ticketId
        docType: 'spec',
        content: '# Test',
      },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  /**
   * Validation error - invalid docType
   */
  test('POST docs returns 400 for invalid docType', async ({ request, projectId }) => {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] Invalid DocType',
        description: 'Test invalid docType',
        stage: 'SPECIFY',
        branch: '036-invalid-type',
        projectId,
        updatedAt: new Date(),
      },
    });

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/docs`, {
      data: {
        ticketId: ticket.id,
        docType: 'invalid', // Invalid type
        content: '# Test',
      },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  /**
   * Validation error - content exceeds 1MB
   */
  test('POST docs returns 400 for content exceeding 1MB', async ({ request, projectId }) => {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 2,
        ticketKey: `E2E${projectId}-2`,
        title: '[e2e] Large Content',
        description: 'Test content size limit',
        stage: 'SPECIFY',
        branch: '036-large-content',
        projectId,
        updatedAt: new Date(),
      },
    });

    // Generate content > 1MB (1,048,576 bytes)
    const largeContent = 'x'.repeat(1048577);

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/docs`, {
      data: {
        ticketId: ticket.id,
        docType: 'spec',
        content: largeContent,
      },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('1MB');
  });
});

test.describe('POST /api/projects/[projectId]/docs - Not Found Errors (404)', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Not found - ticket doesn't exist
   */
  test('POST docs returns 404 for non-existent ticket', async ({ request, projectId }) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/docs`, {
      data: {
        ticketId: 99999, // Non-existent
        docType: 'spec',
        content: '# Test',
      },
    });

    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('TICKET_NOT_FOUND');
  });

  /**
   * Not found - ticket has no branch
   */
  test('POST docs returns 404 BRANCH_NOT_FOUND when ticket has no branch', async ({ request, projectId }) => {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] No Branch',
        description: 'Ticket without branch',
        stage: 'SPECIFY',
        branch: null, // No branch assigned
        projectId,
        updatedAt: new Date(),
      },
    });

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/docs`, {
      data: {
        ticketId: ticket.id,
        docType: 'spec',
        content: '# Test',
      },
    });

    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('BRANCH_NOT_FOUND');
  });
});

/**
 * USER STORY 2: API Contract Tests for Plan/Tasks Editing
 * Tests for tasks T025-T026
 */
test.describe('POST /api/projects/[projectId]/docs - User Story 2: Plan/Tasks', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    ticketCounter2 = 0;
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Helper: Create test ticket with branch
   */
  let ticketCounter2 = 0;
  const createTestTicket = async (
    projectId: number,
    params: {
      stage: Stage;
      branch: string;
      title?: string;
    }
  ) => {
    ticketCounter2++;
    return await prisma.ticket.create({
      data: {
        ticketNumber: ticketCounter2,
        ticketKey: `E2E${projectId}-${ticketCounter2}`,
        title: params.title || '[e2e] US2 API Test',
        description: 'Test ticket for plan/tasks editing',
        stage: params.stage,
        branch: params.branch,
        projectId,
        workflowType: 'FULL',
        updatedAt: new Date(),
      },
    });
  };

  /**
   * T025: POST with docType=plan in PLAN stage returns 200
   * NOTE: GitHub API is mocked in test environment (TEST_MODE=true)
   */
  test('returns 200 when editing plan.md in PLAN stage', async ({ request, projectId }) => {
    // Setup: Create ticket in PLAN stage
    const ticket = await createTestTicket(projectId, {
      stage: 'PLAN',
      branch: '036-us2-plan-api-test',
      title: '[e2e] US2 Plan API Test',
    });

    // Make API request
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/docs`, {
      data: {
        ticketId: ticket.id,
        docType: 'plan',
        content: '# Updated Plan\n\nNew plan content.',
      },
    });

    // Assert response (mocked GitHub API always succeeds in test mode)
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('commitSha');
    expect(data).toHaveProperty('updatedAt');
    expect(data).toHaveProperty('message');
    expect(data.commitSha).toMatch(/^mock-sha-/); // Mock SHA format
    expect(data.message).toContain('plan.md');
  });

  /**
   * T026: POST with docType=tasks in PLAN stage returns 200
   * NOTE: GitHub API is mocked in test environment (TEST_MODE=true)
   */
  test('returns 200 when editing tasks.md in PLAN stage', async ({ request, projectId }) => {
    // Setup: Create ticket in PLAN stage
    const ticket = await createTestTicket(projectId, {
      stage: 'PLAN',
      branch: '036-us2-tasks-api-test',
      title: '[e2e] US2 Tasks API Test',
    });

    // Make API request
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/docs`, {
      data: {
        ticketId: ticket.id,
        docType: 'tasks',
        content: '# Task Breakdown\n\n- [X] Task 1\n- [ ] Task 2',
      },
    });

    // Assert response (mocked GitHub API always succeeds in test mode)
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('commitSha');
    expect(data).toHaveProperty('updatedAt');
    expect(data).toHaveProperty('message');
    expect(data.commitSha).toMatch(/^mock-sha-/); // Mock SHA format
    expect(data.message).toContain('tasks.md');
  });

  /**
   * Permission test: Editing plan.md in SPECIFY stage returns 403
   */
  test('returns 403 when editing plan.md in SPECIFY stage', async ({ request, projectId }) => {
    // Setup: Create ticket in SPECIFY stage
    const ticket = await createTestTicket(projectId, {
      stage: 'SPECIFY',
      branch: '036-us2-plan-permission-test',
      title: '[e2e] US2 Plan Permission Test',
    });

    // Make API request (should fail permission check)
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/docs`, {
      data: {
        ticketId: ticket.id,
        docType: 'plan',
        content: '# Updated Plan',
      },
    });

    // Assert: 403 Forbidden
    expect(response.status()).toBe(403);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('PERMISSION_DENIED');
    expect(data.error).toContain('plan.md');
    expect(data.error).toContain('SPECIFY');
  });

  /**
   * Permission test: Editing tasks.md in SPECIFY stage returns 403
   */
  test('returns 403 when editing tasks.md in SPECIFY stage', async ({ request, projectId }) => {
    // Setup: Create ticket in SPECIFY stage
    const ticket = await createTestTicket(projectId, {
      stage: 'SPECIFY',
      branch: '036-us2-tasks-permission-test',
      title: '[e2e] US2 Tasks Permission Test',
    });

    // Make API request (should fail permission check)
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/docs`, {
      data: {
        ticketId: ticket.id,
        docType: 'tasks',
        content: '# Task Breakdown',
      },
    });

    // Assert: 403 Forbidden
    expect(response.status()).toBe(403);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('PERMISSION_DENIED');
    expect(data.error).toContain('tasks.md');
    expect(data.error).toContain('SPECIFY');
  });
});
