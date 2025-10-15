import { test, expect } from '@playwright/test';
import { cleanupDatabase, getPrismaClient } from '../helpers/db-cleanup';
import { ClarificationPolicy } from '@prisma/client';

/**
 * Contract Tests: GET/PATCH /api/projects/[id] - clarificationPolicy field
 * Feature: 029-999-auto-clarification (User Story 1)
 * Source: specs/029-999-auto-clarification/contracts/api-contracts.yaml
 *
 * ⚠️ CRITICAL: These tests MUST FAIL initially (TDD requirement)
 * They should only pass after implementation of project policy endpoints in Phase 3
 */

test.describe('GET /api/projects/[id] - clarificationPolicy field', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * T001: GET project returns clarificationPolicy field (default AUTO)
   */
  test('GET project returns clarificationPolicy with default AUTO', async ({ request }) => {
    // Verify project 1 exists with default policy
    const project = await prisma.project.findUnique({ where: { id: 1 } });
    expect(project).toBeDefined();

    // GET project
    const response = await request.get(`${BASE_URL}/api/projects/1`);

    // Assert 200 OK
    expect(response.status()).toBe(200);

    // Assert response includes clarificationPolicy
    const data = await response.json();
    expect(data).toHaveProperty('clarificationPolicy');
    expect(data.clarificationPolicy).toBe('AUTO');
  });

  /**
   * T002: GET project returns clarificationPolicy for all policy values
   */
  test('GET project returns clarificationPolicy for CONSERVATIVE', async ({ request }) => {
    // Update project 1 to CONSERVATIVE
    await prisma.project.update({
      where: { id: 1 },
      data: { clarificationPolicy: ClarificationPolicy.CONSERVATIVE },
    });

    // GET project
    const response = await request.get(`${BASE_URL}/api/projects/1`);

    // Assert response includes CONSERVATIVE policy
    const data = await response.json();
    expect(data.clarificationPolicy).toBe('CONSERVATIVE');
  });

  test('GET project returns clarificationPolicy for PRAGMATIC', async ({ request }) => {
    // Update project 1 to PRAGMATIC
    await prisma.project.update({
      where: { id: 1 },
      data: { clarificationPolicy: ClarificationPolicy.PRAGMATIC },
    });

    // GET project
    const response = await request.get(`${BASE_URL}/api/projects/1`);

    // Assert response includes PRAGMATIC policy
    const data = await response.json();
    expect(data.clarificationPolicy).toBe('PRAGMATIC');
  });

  test('GET project returns clarificationPolicy for INTERACTIVE', async ({ request }) => {
    // Update project 1 to INTERACTIVE
    await prisma.project.update({
      where: { id: 1 },
      data: { clarificationPolicy: ClarificationPolicy.INTERACTIVE },
    });

    // GET project
    const response = await request.get(`${BASE_URL}/api/projects/1`);

    // Assert response includes INTERACTIVE policy
    const data = await response.json();
    expect(data.clarificationPolicy).toBe('INTERACTIVE');
  });

  /**
   * T003: GET non-existent project returns 404
   */
  test('GET non-existent project returns 404', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/projects/99999`);
    expect(response.status()).toBe(404);
  });
});

test.describe('PATCH /api/projects/[id] - clarificationPolicy updates', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * T004: PATCH project with valid clarificationPolicy updates field
   */
  test('PATCH project to CONSERVATIVE updates clarificationPolicy', async ({ request }) => {
    // Verify initial state (AUTO by default)
    const initialProject = await prisma.project.findUnique({ where: { id: 1 } });
    expect(initialProject?.clarificationPolicy).toBe('AUTO');

    // PATCH to CONSERVATIVE
    const response = await request.patch(`${BASE_URL}/api/projects/1`, {
      data: { clarificationPolicy: 'CONSERVATIVE' },
    });

    // Assert 200 OK
    expect(response.status()).toBe(200);

    // Assert response body
    const updatedProject = await response.json();
    expect(updatedProject.clarificationPolicy).toBe('CONSERVATIVE');

    // Verify database state
    const dbProject = await prisma.project.findUnique({ where: { id: 1 } });
    expect(dbProject?.clarificationPolicy).toBe('CONSERVATIVE');
  });

  test('PATCH project to PRAGMATIC updates clarificationPolicy', async ({ request }) => {
    // PATCH to PRAGMATIC
    const response = await request.patch(`${BASE_URL}/api/projects/1`, {
      data: { clarificationPolicy: 'PRAGMATIC' },
    });

    expect(response.status()).toBe(200);

    const updatedProject = await response.json();
    expect(updatedProject.clarificationPolicy).toBe('PRAGMATIC');
  });

  test('PATCH project to INTERACTIVE updates clarificationPolicy', async ({ request }) => {
    // PATCH to INTERACTIVE
    const response = await request.patch(`${BASE_URL}/api/projects/1`, {
      data: { clarificationPolicy: 'INTERACTIVE' },
    });

    expect(response.status()).toBe(200);

    const updatedProject = await response.json();
    expect(updatedProject.clarificationPolicy).toBe('INTERACTIVE');
  });

  test('PATCH project back to AUTO updates clarificationPolicy', async ({ request }) => {
    // First set to CONSERVATIVE
    await prisma.project.update({
      where: { id: 1 },
      data: { clarificationPolicy: ClarificationPolicy.CONSERVATIVE },
    });

    // PATCH back to AUTO
    const response = await request.patch(`${BASE_URL}/api/projects/1`, {
      data: { clarificationPolicy: 'AUTO' },
    });

    expect(response.status()).toBe(200);

    const updatedProject = await response.json();
    expect(updatedProject.clarificationPolicy).toBe('AUTO');
  });

  /**
   * T005: PATCH project with invalid policy returns 400
   */
  test('PATCH project with invalid policy returns 400 validation error', async ({ request }) => {
    // PATCH with invalid policy value
    const response = await request.patch(`${BASE_URL}/api/projects/1`, {
      data: { clarificationPolicy: 'INVALID_POLICY' },
    });

    // Assert 400 Bad Request
    expect(response.status()).toBe(400);

    // Assert error response structure (Zod validation)
    const error = await response.json();
    expect(error.error).toBe('Validation failed');
    expect(error.issues).toBeDefined();
    expect(Array.isArray(error.issues)).toBe(true);
    expect(error.issues[0].path).toContain('clarificationPolicy');
  });

  test('PATCH project with null policy returns 400 validation error', async ({ request }) => {
    // PATCH with null (project policy is NOT NULL)
    const response = await request.patch(`${BASE_URL}/api/projects/1`, {
      data: { clarificationPolicy: null },
    });

    // Assert 400 Bad Request
    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error.error).toBe('Validation failed');
  });

  /**
   * T006: PATCH project with other fields does not affect clarificationPolicy
   */
  test('PATCH project name does not affect clarificationPolicy', async ({ request }) => {
    // Set initial policy to CONSERVATIVE
    await prisma.project.update({
      where: { id: 1 },
      data: { clarificationPolicy: ClarificationPolicy.CONSERVATIVE },
    });

    // PATCH only name
    const response = await request.patch(`${BASE_URL}/api/projects/1`, {
      data: { name: 'Updated Project Name' },
    });

    expect(response.status()).toBe(200);

    // Verify policy unchanged
    const updatedProject = await response.json();
    expect(updatedProject.clarificationPolicy).toBe('CONSERVATIVE');
  });

  /**
   * T007: PATCH non-existent project returns 404
   */
  test('PATCH non-existent project returns 404', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/projects/99999`, {
      data: { clarificationPolicy: 'CONSERVATIVE' },
    });

    expect(response.status()).toBe(404);
  });

  /**
   * T008: PATCH project policy persists across multiple updates
   */
  test('PATCH project policy persists across multiple updates', async ({ request }) => {
    // Update 1: AUTO → CONSERVATIVE
    await request.patch(`${BASE_URL}/api/projects/1`, {
      data: { clarificationPolicy: 'CONSERVATIVE' },
    });

    // Update 2: CONSERVATIVE → PRAGMATIC
    await request.patch(`${BASE_URL}/api/projects/1`, {
      data: { clarificationPolicy: 'PRAGMATIC' },
    });

    // Update 3: PRAGMATIC → AUTO
    const response = await request.patch(`${BASE_URL}/api/projects/1`, {
      data: { clarificationPolicy: 'AUTO' },
    });

    expect(response.status()).toBe(200);

    // Verify final state
    const finalProject = await response.json();
    expect(finalProject.clarificationPolicy).toBe('AUTO');

    // Verify database
    const dbProject = await prisma.project.findUnique({ where: { id: 1 } });
    expect(dbProject?.clarificationPolicy).toBe('AUTO');
  });
});

test.describe('PATCH /api/projects/[id] - Response Format', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * T009: PATCH response includes all expected project fields
   */
  test('PATCH response includes all expected project fields', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/projects/1`, {
      data: { clarificationPolicy: 'CONSERVATIVE' },
    });

    expect(response.status()).toBe(200);

    const project = await response.json();

    // Verify response structure (from existing project API contract)
    expect(project).toHaveProperty('id');
    expect(project).toHaveProperty('name');
    expect(project).toHaveProperty('description');
    expect(project).toHaveProperty('githubOwner');
    expect(project).toHaveProperty('githubRepo');
    expect(project).toHaveProperty('clarificationPolicy');
    expect(project).toHaveProperty('createdAt');
    expect(project).toHaveProperty('updatedAt');
  });

  /**
   * T010: PATCH updates updatedAt timestamp
   */
  test('PATCH updates updatedAt timestamp', async ({ request }) => {
    // Get initial updatedAt
    const initialProject = await prisma.project.findUnique({ where: { id: 1 } });
    const initialUpdatedAt = initialProject?.updatedAt;

    // Wait 10ms to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    // PATCH policy
    const response = await request.patch(`${BASE_URL}/api/projects/1`, {
      data: { clarificationPolicy: 'CONSERVATIVE' },
    });

    expect(response.status()).toBe(200);

    // Verify updatedAt changed
    const updatedProject = await response.json();
    const newUpdatedAt = new Date(updatedProject.updatedAt);
    expect(newUpdatedAt.getTime()).toBeGreaterThan(initialUpdatedAt!.getTime());
  });
});
