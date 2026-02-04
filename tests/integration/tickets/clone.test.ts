/**
 * Integration Tests: Ticket Clone/Duplicate API
 *
 * Tests for full clone and simple copy functionality:
 * - Full clone: preserves stage, creates branch, copies jobs with telemetry
 * - Simple copy: creates ticket in INBOX stage, no jobs, no branch
 * - Eligibility validation: full clone only for SPECIFY/PLAN/BUILD/VERIFY stages
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Ticket Clone/Duplicate API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('Simple Copy (POST /api/projects/:projectId/tickets/:id/duplicate)', () => {
    it('should create ticket in INBOX stage with "Copy of " prefix', async () => {
      // Create source ticket
      const sourceTicket = await ctx.createTicket({
        title: '[e2e] Original Feature',
        description: 'Original description',
      });

      const response = await ctx.api.post<{
        id: number;
        title: string;
        description: string;
        stage: string;
        branch: string | null;
        ticketKey: string;
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/duplicate`);

      expect(response.status).toBe(201);
      expect(response.data.title).toBe('Copy of [e2e] Original Feature');
      expect(response.data.description).toBe('Original description');
      expect(response.data.stage).toBe('INBOX');
      expect(response.data.branch).toBeNull();
      expect(response.data.id).not.toBe(sourceTicket.id);
    });

    it('should not copy jobs for simple copy', async () => {
      const prisma = getPrismaClient();

      // Create source ticket with a job
      const sourceTicket = await ctx.createTicket({
        title: '[e2e] Ticket with Job',
        description: 'Has jobs',
        stage: 'BUILD',
      });

      // Update ticket to have a branch
      await prisma.ticket.update({
        where: { id: sourceTicket.id },
        data: { branch: '123-ticket-with-job' },
      });

      // Create a job for source ticket
      await prisma.job.create({
        data: {
          ticketId: sourceTicket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: 'COMPLETED',
          startedAt: new Date(),
          completedAt: new Date(),
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 0.05,
          durationMs: 30000,
          model: 'claude-3-opus',
        },
      });

      // Simple copy (no fullClone parameter)
      const response = await ctx.api.post<{
        id: number;
        stage: string;
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/duplicate`);

      expect(response.status).toBe(201);
      expect(response.data.stage).toBe('INBOX');

      // Verify no jobs were copied
      const newTicketJobs = await prisma.job.findMany({
        where: { ticketId: response.data.id },
      });
      expect(newTicketJobs).toHaveLength(0);
    });

    it('should create ticket with no branch for simple copy', async () => {
      const prisma = getPrismaClient();

      // Create source ticket with a branch
      const sourceTicket = await ctx.createTicket({
        title: '[e2e] Ticket with Branch',
        description: 'Has branch',
        stage: 'BUILD',
      });

      await prisma.ticket.update({
        where: { id: sourceTicket.id },
        data: { branch: '123-ticket-with-branch' },
      });

      const response = await ctx.api.post<{
        id: number;
        branch: string | null;
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/duplicate`);

      expect(response.status).toBe(201);
      expect(response.data.branch).toBeNull();
    });
  });

  describe('Full Clone (POST /api/projects/:projectId/tickets/:id/duplicate?fullClone=true)', () => {
    it('should return 400 for INBOX stage tickets', async () => {
      const sourceTicket = await ctx.createTicket({
        title: '[e2e] INBOX Ticket',
        description: 'Still in inbox',
        stage: 'INBOX',
      });

      const response = await ctx.api.post<{
        error: string;
        code: string;
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/duplicate?fullClone=true`);

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
      expect(response.data.error).toContain('INBOX');
    });

    it('should return 400 for SHIP stage tickets', async () => {
      const prisma = getPrismaClient();

      const sourceTicket = await ctx.createTicket({
        title: '[e2e] SHIP Ticket',
        description: 'Already shipped',
        stage: 'SHIP',
      });

      await prisma.ticket.update({
        where: { id: sourceTicket.id },
        data: { branch: '123-ship-ticket' },
      });

      const response = await ctx.api.post<{
        error: string;
        code: string;
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/duplicate?fullClone=true`);

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
      expect(response.data.error).toContain('SHIP');
    });

    it('should return 400 for tickets without branch', async () => {
      const prisma = getPrismaClient();

      const sourceTicket = await ctx.createTicket({
        title: '[e2e] No Branch Ticket',
        description: 'Has no branch',
        stage: 'INBOX',
      });

      // Update to BUILD stage but without branch
      await prisma.ticket.update({
        where: { id: sourceTicket.id },
        data: { stage: 'BUILD', branch: null },
      });

      const response = await ctx.api.post<{
        error: string;
        code: string;
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/duplicate?fullClone=true`);

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
      expect(response.data.error.toLowerCase()).toContain('branch');
    });

    it('should return 400 for CLOSED stage tickets', async () => {
      const prisma = getPrismaClient();

      const sourceTicket = await ctx.createTicket({
        title: '[e2e] CLOSED Ticket',
        description: 'Already closed',
        stage: 'INBOX',
      });

      await prisma.ticket.update({
        where: { id: sourceTicket.id },
        data: { stage: 'CLOSED', branch: '123-closed-ticket' },
      });

      const response = await ctx.api.post<{
        error: string;
        code: string;
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/duplicate?fullClone=true`);

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Validation and Error Handling', () => {
    it('should return 404 for non-existent ticket', async () => {
      const response = await ctx.api.post<{
        error: string;
        code: string;
      }>(`/api/projects/${ctx.projectId}/tickets/99999/duplicate`);

      expect(response.status).toBe(404);
      expect(response.data.code).toBe('TICKET_NOT_FOUND');
    });

    it('should return 400 for invalid ticket ID', async () => {
      const response = await ctx.api.post<{
        error: string;
        code: string;
      }>(`/api/projects/${ctx.projectId}/tickets/invalid/duplicate`);

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });

    it('should handle title truncation at max length', async () => {
      // Create ticket with title at max length (100 chars)
      const longTitle = '[e2e] ' + 'A'.repeat(93); // 99 chars total
      const sourceTicket = await ctx.createTicket({
        title: longTitle,
        description: 'Long title test',
      });

      const response = await ctx.api.post<{
        title: string;
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/duplicate`);

      expect(response.status).toBe(201);
      // "Copy of " prefix is 8 chars, so title should be truncated to fit 100 char limit
      expect(response.data.title.length).toBeLessThanOrEqual(100);
      expect(response.data.title).toContain('Copy of');
    });
  });
});
