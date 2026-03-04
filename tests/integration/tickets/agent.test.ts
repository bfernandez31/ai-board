/**
 * Integration Tests: Ticket Agent Field
 *
 * Tests for the agent field on tickets and defaultAgent on projects.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Ticket Agent Field', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('POST /api/projects/:projectId/tickets - agent field', () => {
    it('should create ticket with agent=null by default', async () => {
      const response = await ctx.api.post<{ id: number; agent: string | null }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Ticket without agent',
          description: 'Should default to null agent',
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.agent).toBeNull();
    });

    it('should create ticket with agent=CLAUDE', async () => {
      const response = await ctx.api.post<{ id: number; agent: string | null }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Claude ticket',
          description: 'Ticket with CLAUDE agent',
          agent: 'CLAUDE',
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.agent).toBe('CLAUDE');
    });

    it('should create ticket with agent=CODEX', async () => {
      const response = await ctx.api.post<{ id: number; agent: string | null }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Codex ticket',
          description: 'Ticket with CODEX agent',
          agent: 'CODEX',
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.agent).toBe('CODEX');
    });

    it('should reject invalid agent value', async () => {
      const response = await ctx.api.post<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Invalid agent ticket',
          description: 'Ticket with invalid agent',
          agent: 'INVALID',
        }
      );

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/projects/:projectId/tickets/:id - agent field', () => {
    it('should update ticket agent to CODEX', async () => {
      const { id: ticketId } = await ctx.createTicket({
        title: '[e2e] Agent update test',
        description: 'Test agent update',
      });

      const response = await ctx.api.patch<{ id: number; agent: string | null }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}`,
        { agent: 'CODEX', version: 1 }
      );

      expect(response.status).toBe(200);
      expect(response.data.agent).toBe('CODEX');
    });

    it('should set agent to null', async () => {
      // Create ticket with agent
      const createResponse = await ctx.api.post<{ id: number; version: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Agent null test',
          description: 'Test setting agent to null',
          agent: 'CLAUDE',
        }
      );

      const response = await ctx.api.patch<{ id: number; agent: string | null }>(
        `/api/projects/${ctx.projectId}/tickets/${createResponse.data.id}`,
        { agent: null, version: createResponse.data.version }
      );

      expect(response.status).toBe(200);
      expect(response.data.agent).toBeNull();
    });
  });

  describe('GET /api/projects/:projectId/tickets/:id - agent field', () => {
    it('should return agent field in ticket response', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Agent GET test',
          description: 'Test agent in GET response',
          agent: 'CODEX',
        }
      );

      const response = await ctx.api.get<{ id: number; agent: string | null }>(
        `/api/projects/${ctx.projectId}/tickets/${createResponse.data.id}`
      );

      expect(response.status).toBe(200);
      expect(response.data.agent).toBe('CODEX');
    });
  });
});

describe('Project defaultAgent Field', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('GET /api/projects/:id - defaultAgent field', () => {
    it('should return defaultAgent with default CLAUDE', async () => {
      const response = await ctx.api.get<{ defaultAgent: string }>(
        `/api/projects/${ctx.projectId}`
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('defaultAgent');
      expect(response.data.defaultAgent).toBe('CLAUDE');
    });
  });

  describe('PATCH /api/projects/:id - defaultAgent updates', () => {
    it('should update defaultAgent to CODEX', async () => {
      const response = await ctx.api.patch<{ defaultAgent: string }>(
        `/api/projects/${ctx.projectId}`,
        { defaultAgent: 'CODEX' }
      );

      expect(response.status).toBe(200);
      expect(response.data.defaultAgent).toBe('CODEX');

      // Verify database
      const dbProject = await prisma.project.findUnique({ where: { id: ctx.projectId } });
      expect(dbProject?.defaultAgent).toBe('CODEX');
    });

    it('should update defaultAgent back to CLAUDE', async () => {
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { defaultAgent: 'CODEX' },
      });

      const response = await ctx.api.patch<{ defaultAgent: string }>(
        `/api/projects/${ctx.projectId}`,
        { defaultAgent: 'CLAUDE' }
      );

      expect(response.status).toBe(200);
      expect(response.data.defaultAgent).toBe('CLAUDE');
    });

    it('should return 400 for invalid agent value', async () => {
      const response = await ctx.api.patch<{ error: string; issues: unknown[] }>(
        `/api/projects/${ctx.projectId}`,
        { defaultAgent: 'INVALID_AGENT' }
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Validation failed');
    });

    it('should not affect defaultAgent when updating other fields', async () => {
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { defaultAgent: 'CODEX' },
      });

      const response = await ctx.api.patch<{ defaultAgent: string }>(
        `/api/projects/${ctx.projectId}`,
        { clarificationPolicy: 'CONSERVATIVE' }
      );

      expect(response.status).toBe(200);
      expect(response.data.defaultAgent).toBe('CODEX');
    });
  });
});
