/**
 * API Contract Tests: Documentation History Endpoints
 * Feature: 036-mode-to-update
 * User Story 3: Commit History and Change Tracking
 *
 * Tests:
 * - T034: GET /api/projects/:id/docs/history endpoint contract
 * - GET /api/projects/:id/docs/diff endpoint contract
 *
 * Test Strategy:
 * - All tests use conditional assertions based on GITHUB_TOKEN availability
 * - Permission tests always work (fail before GitHub API call)
 * - Success tests require GITHUB_TOKEN environment variable
 *
 * Prerequisites:
 * - Test project 1 exists with githubOwner and githubRepo
 * - Test user authenticated via global-setup
 */

import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db/client';
import { cleanupDatabase } from '../helpers/db-cleanup';

const BASE_URL = 'http://localhost:3000';

// Helper to create test ticket with required fields
async function createTestTicket(overrides: {
  stage: 'SPECIFY' | 'PLAN' | 'BUILD';
  branch: string;
}) {
  return await prisma.ticket.create({
    data: {
      title: '[e2e] History API Test Ticket',
      description: 'Testing commit history API',
      stage: overrides.stage,
      branch: overrides.branch,
      projectId: 1,
      workflowType: 'FULL',
      updatedAt: new Date(),
    },
  });
}

// Helper to create test job
async function createTestJob(data: {
  ticketId: number;
  command: 'specify' | 'plan' | 'tasks';
  status: 'COMPLETED' | 'RUNNING' | 'FAILED';
}) {
  return await prisma.job.create({
    data: {
      ticketId: data.ticketId,
      projectId: 1,
      command: data.command,
      status: data.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

test.describe('GET /api/projects/:projectId/docs/history - API Contract (T034)', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test('returns 200 with commit history when ticket has valid branch', async ({ request }) => {
    // Create ticket with branch
    const ticket = await createTestTicket({
      stage: 'SPECIFY',
      branch: '036-us3-api-history-test',
    });

    // Create completed job (ticket progressed through SPECIFY)
    await createTestJob({
      ticketId: ticket.id,
      command: 'specify',
      status: 'COMPLETED',
    });

    // Make API request
    const response = await request.get(
      `${BASE_URL}/api/projects/1/docs/history?ticketId=${ticket.id}&docType=spec`
    );

    // Assert response (mocked GitHub API always succeeds in test mode)
    expect(response.status()).toBe(200);
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('commits');
    expect(Array.isArray(data.commits)).toBe(true);
    expect(data.commits.length).toBeGreaterThan(0); // Mock always returns at least 1 commit

    // Verify mock commit structure
    const commit = data.commits[0];
    expect(commit).toHaveProperty('sha');
    expect(commit).toHaveProperty('author');
    expect(commit).toHaveProperty('message');
    expect(commit).toHaveProperty('url');

    // Verify author structure
    expect(commit.author).toHaveProperty('name');
    expect(commit.author).toHaveProperty('email');
    expect(commit.author).toHaveProperty('date');

    // Verify mock SHA format
    expect(commit.sha).toMatch(/^mock-sha-/);

    // Verify date is ISO 8601
    expect(commit.author.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('returns 400 for invalid docType', async ({ request }) => {
    // Create ticket with branch
    const ticket = await createTestTicket({
      stage: 'SPECIFY',
      branch: '036-us3-api-invalid-doctype',
    });

    // Make API request with invalid docType
    const response = await request.get(
      `${BASE_URL}/api/projects/1/docs/history?ticketId=${ticket.id}&docType=invalid`
    );

    // Should fail validation before GitHub API call
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 for missing query parameters', async ({ request }) => {
    // Missing ticketId
    let response = await request.get(`${BASE_URL}/api/projects/1/docs/history?docType=spec`);
    expect(response.status()).toBe(400);

    // Missing docType
    response = await request.get(`${BASE_URL}/api/projects/1/docs/history?ticketId=1`);
    expect(response.status()).toBe(400);
  });

  test('returns 404 when ticket has no branch', async ({ request }) => {
    // Create ticket without branch
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] No Branch Ticket',
        description: 'Testing 404 for missing branch',
        stage: 'INBOX',
        branch: null, // No branch
        projectId: 1,
        workflowType: 'FULL',
        updatedAt: new Date(),
      },
    });

    const response = await request.get(
      `${BASE_URL}/api/projects/1/docs/history?ticketId=${ticket.id}&docType=spec`
    );

    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data.code).toBe('BRANCH_NOT_FOUND');
  });

  test('returns 404 when ticket does not exist', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/projects/1/docs/history?ticketId=99999&docType=spec`
    );

    expect(response.status()).toBe(404);
  });
});

test.describe('GET /api/projects/:projectId/docs/diff - API Contract', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test('returns 200 with diff when valid commit SHA provided', async ({ request }) => {
    // Create ticket with branch
    const ticket = await createTestTicket({
      stage: 'SPECIFY',
      branch: '036-us3-api-diff-test',
    });

    // Create completed job
    await createTestJob({
      ticketId: ticket.id,
      command: 'specify',
      status: 'COMPLETED',
    });

    // Use a valid commit SHA format
    const validSha = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';

    const response = await request.get(
      `${BASE_URL}/api/projects/1/docs/diff?ticketId=${ticket.id}&docType=spec&sha=${validSha}`
    );

    // Assert response (mocked GitHub API always succeeds in test mode)
    expect(response.status()).toBe(200);
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('sha');
    expect(data).toHaveProperty('files');
    expect(Array.isArray(data.files)).toBe(true);
    expect(data.files.length).toBeGreaterThan(0); // Mock always returns at least 1 file

    // Verify mock file structure
    const file = data.files[0];
    expect(file).toHaveProperty('filename');
    expect(file).toHaveProperty('status');
    expect(file).toHaveProperty('additions');
    expect(file).toHaveProperty('deletions');
    expect(file).toHaveProperty('patch');

    // Status should be one of the expected values
    expect(['added', 'modified', 'removed']).toContain(file.status);

    // Verify mock data
    expect(data.sha).toBe(validSha);
    expect(file.filename).toMatch(/^specs\//);
  });

  test('returns 400 for invalid SHA format', async ({ request }) => {
    // Create ticket with branch
    const ticket = await createTestTicket({
      stage: 'SPECIFY',
      branch: '036-us3-api-invalid-sha',
    });

    // Invalid SHA (too short)
    const response = await request.get(
      `${BASE_URL}/api/projects/1/docs/diff?ticketId=${ticket.id}&docType=spec&sha=invalid`
    );

    // Should fail validation before GitHub API call
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 for missing SHA parameter', async ({ request }) => {
    // Create ticket with branch
    const ticket = await createTestTicket({
      stage: 'SPECIFY',
      branch: '036-us3-api-missing-sha',
    });

    const response = await request.get(
      `${BASE_URL}/api/projects/1/docs/diff?ticketId=${ticket.id}&docType=spec`
    );

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  test('returns 404 when ticket has no branch', async ({ request }) => {
    // Create ticket without branch
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] No Branch Diff Test',
        description: 'Testing 404 for missing branch',
        stage: 'INBOX',
        branch: null,
        projectId: 1,
        workflowType: 'FULL',
        updatedAt: new Date(),
      },
    });

    const validSha = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';
    const response = await request.get(
      `${BASE_URL}/api/projects/1/docs/diff?ticketId=${ticket.id}&docType=spec&sha=${validSha}`
    );

    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data.code).toBe('BRANCH_NOT_FOUND');
  });
});
