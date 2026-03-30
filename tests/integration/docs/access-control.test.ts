/**
 * Integration Tests: Documentation Endpoints Access Control
 * Feature: AIB-400 — Fix IDOR on docs diff/history endpoints
 *
 * Verifies that docs diff and history endpoints enforce project access checks
 * (owner OR member), rejecting requests from non-members/non-owners.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Documentation Endpoints Access Control', () => {
  let ctx: TestContext;
  let ticketId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    // Create a test ticket via the helper (directly in DB for reliability)
    const ticket = await ctx.createTicket({
      title: '[e2e] Docs Access Control Test',
      description: 'Test ticket for docs access control',
    });
    ticketId = ticket.id;

    // Set a branch on the ticket so the endpoint doesn't return BRANCH_NOT_FOUND
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { branch: 'AIB-999-test-branch' },
    });
  });

  describe('GET /api/projects/:projectId/docs/diff', () => {
    it('should return 200 for project owner', async () => {
      const response = await ctx.api.get(
        `/api/projects/${ctx.projectId}/docs/diff?ticketId=${ticketId}&docType=spec&sha=abc123def456abc123def456abc123def456abcd`
      );

      expect(response.status).toBe(200);
    });

    it('should return 403 for non-member/non-owner', async () => {
      // Use a project ID that the test user does not own or belong to
      const response = await ctx.api.get(
        `/api/projects/999999/docs/diff?ticketId=${ticketId}&docType=spec&sha=abc123def456abc123def456abc123def456abcd`
      );

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/projects/:projectId/docs/history', () => {
    it('should return 200 for project owner', async () => {
      const response = await ctx.api.get(
        `/api/projects/${ctx.projectId}/docs/history?ticketId=${ticketId}&docType=spec`
      );

      expect(response.status).toBe(200);
    });

    it('should return 403 for non-member/non-owner', async () => {
      // Use a project ID that the test user does not own or belong to
      const response = await ctx.api.get(
        `/api/projects/999999/docs/history?ticketId=${ticketId}&docType=spec`
      );

      expect(response.status).toBe(403);
    });
  });
});
