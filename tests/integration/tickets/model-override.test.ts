/**
 * Integration Tests: Ticket model override endpoint (AIB-678)
 *
 * Covers: PATCH /api/projects/:projectId/tickets/:id/model-config
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { Agent } from '@prisma/client';

describe('PATCH /api/projects/:projectId/tickets/:id/model-config (AIB-678)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('sets a single stage override and leaves the others null', async () => {
    const ticket = await ctx.createTicket();

    const response = await ctx.api.patch<{
      ticketId: number;
      verifyModel: string | null;
      specifyModel: string | null;
      hasAnyOverride: boolean;
      overriddenStages: string[];
    }>(`/api/projects/${ctx.projectId}/tickets/${ticket.id}/model-config`, {
      verifyModel: 'claude-opus-4-7',
    });

    expect(response.status).toBe(200);
    expect(response.data.verifyModel).toBe('claude-opus-4-7');
    expect(response.data.specifyModel).toBeNull();
    expect(response.data.hasAnyOverride).toBe(true);
    expect(response.data.overriddenStages).toEqual(['VERIFY']);

    const db = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(db?.verifyModel).toBe('claude-opus-4-7');
    expect(db?.specifyModel).toBeNull();
    expect(db?.planModel).toBeNull();
    expect(db?.implementModel).toBeNull();
    expect(db?.quickImplModel).toBeNull();
  });

  it('resets all 5 columns when resetAll is true', async () => {
    const ticket = await ctx.createTicket();
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        specifyModel: 'claude-opus-4-7',
        planModel: 'claude-opus-4-7',
        implementModel: 'claude-sonnet-4-6',
        quickImplModel: 'claude-sonnet-4-6',
        verifyModel: 'claude-sonnet-4-6',
      },
    });

    const response = await ctx.api.patch<{
      specifyModel: string | null;
      planModel: string | null;
      implementModel: string | null;
      quickImplModel: string | null;
      verifyModel: string | null;
      hasAnyOverride: boolean;
    }>(`/api/projects/${ctx.projectId}/tickets/${ticket.id}/model-config`, {
      resetAll: true,
    });

    expect(response.status).toBe(200);
    expect(response.data.specifyModel).toBeNull();
    expect(response.data.planModel).toBeNull();
    expect(response.data.implementModel).toBeNull();
    expect(response.data.quickImplModel).toBeNull();
    expect(response.data.verifyModel).toBeNull();
    expect(response.data.hasAnyOverride).toBe(false);
  });

  it('returns 400 INVALID_MODEL_ID for an unknown model', async () => {
    const ticket = await ctx.createTicket();

    const response = await ctx.api.patch<{ error: string; code?: string }>(
      `/api/projects/${ctx.projectId}/tickets/${ticket.id}/model-config`,
      { implementModel: 'claude-unknown-mystery' }
    );

    expect(response.status).toBe(400);
    expect(response.data.code).toBe('INVALID_MODEL_ID');
  });

  it('returns 400 when no field is provided', async () => {
    const ticket = await ctx.createTicket();

    const response = await ctx.api.patch<{ error: string }>(
      `/api/projects/${ctx.projectId}/tickets/${ticket.id}/model-config`,
      {}
    );

    expect(response.status).toBe(400);
  });

  it('returns 404 when requester is not a member of the project', async () => {
    const ticket = await ctx.createTicket();
    const outsider = await ctx.createUser(`outsider-${Date.now()}@e2e.local`);

    const response = await ctx.api.patch<{ error: string }>(
      `/api/projects/${ctx.projectId}/tickets/${ticket.id}/model-config`,
      { planModel: 'claude-sonnet-4-6' },
      { headers: { 'x-test-user-id': outsider.id } }
    );

    expect(response.status).toBe(404);
  });

  it('allows a project member (non-owner) to update a ticket override', async () => {
    const ticket = await ctx.createTicket();
    const member = await ctx.createUser(`member-${Date.now()}@project${ctx.projectId}.e2e.test`);

    await prisma.projectMember.create({
      data: {
        projectId: ctx.projectId,
        userId: member.id,
        role: 'member',
      },
    });

    const response = await ctx.api.patch<{ planModel: string | null }>(
      `/api/projects/${ctx.projectId}/tickets/${ticket.id}/model-config`,
      { planModel: 'claude-opus-4-6' },
      { headers: { 'x-test-user-id': member.id } }
    );

    expect(response.status).toBe(200);
    expect(response.data.planModel).toBe('claude-opus-4-6');
  });

  it('preserves ticket overrides when project defaultAgent changes', async () => {
    const ticket = await ctx.createTicket();
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { implementModel: 'claude-sonnet-4-6' },
    });

    // Change the project's default agent to non-Claude
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: Agent.GEMINI },
    });

    const db = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(db?.implementModel).toBe('claude-sonnet-4-6');

    // Subsequent PATCH on the ticket still works and preserves other stored overrides
    const response = await ctx.api.patch<{
      implementModel: string | null;
      specifyModel: string | null;
    }>(`/api/projects/${ctx.projectId}/tickets/${ticket.id}/model-config`, {
      specifyModel: 'claude-opus-4-7',
    });

    expect(response.status).toBe(200);
    expect(response.data.implementModel).toBe('claude-sonnet-4-6');
    expect(response.data.specifyModel).toBe('claude-opus-4-7');
  });

  describe('POST /api/projects/:projectId/tickets/bulk/model', () => {
    it('writes the chosen model to all 5 per-command override fields atomically', async () => {
      const t1 = await ctx.createTicket({ title: '[e2e] bulk model 1' });
      const t2 = await ctx.createTicket({ title: '[e2e] bulk model 2' });

      const response = await ctx.api.post<{
        success: true;
        updated: { appliedFields: readonly string[]; count: number };
      }>(`/api/projects/${ctx.projectId}/tickets/bulk/model`, {
        ticketIds: [t1.id, t2.id],
        model: 'claude-opus-4-7',
      });

      expect(response.status).toBe(200);
      expect(response.data.updated.count).toBe(2);
      expect(response.data.updated.appliedFields).toEqual([
        'specifyModel',
        'planModel',
        'implementModel',
        'quickImplModel',
        'verifyModel',
      ]);

      const rows = await prisma.ticket.findMany({ where: { id: { in: [t1.id, t2.id] } } });
      for (const r of rows) {
        expect(r.specifyModel).toBe('claude-opus-4-7');
        expect(r.planModel).toBe('claude-opus-4-7');
        expect(r.implementModel).toBe('claude-opus-4-7');
        expect(r.quickImplModel).toBe('claude-opus-4-7');
        expect(r.verifyModel).toBe('claude-opus-4-7');
      }
    });

    it('clears all 5 fields when model is null', async () => {
      const t = await ctx.createTicket({ title: '[e2e] bulk model clear' });
      await prisma.ticket.update({
        where: { id: t.id },
        data: {
          specifyModel: 'claude-opus-4-7',
          planModel: 'claude-opus-4-7',
          implementModel: 'claude-opus-4-7',
          quickImplModel: 'claude-opus-4-7',
          verifyModel: 'claude-opus-4-7',
        },
      });
      const response = await ctx.api.post<{ success: true }>(
        `/api/projects/${ctx.projectId}/tickets/bulk/model`,
        { ticketIds: [t.id], model: null }
      );
      expect(response.status).toBe(200);
      const row = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(row!.specifyModel).toBeNull();
      expect(row!.planModel).toBeNull();
      expect(row!.implementModel).toBeNull();
      expect(row!.quickImplModel).toBeNull();
      expect(row!.verifyModel).toBeNull();
    });

    it('returns 400 VALIDATION_ERROR when model exceeds 50 chars', async () => {
      const t = await ctx.createTicket({ title: '[e2e] bulk model too long' });
      const response = await ctx.api.post<{ code: string }>(
        `/api/projects/${ctx.projectId}/tickets/bulk/model`,
        { ticketIds: [t.id], model: 'm'.repeat(51) }
      );
      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 409 BULK_CONFLICT_STAGE_DRIFT when a ticket drifted out of INBOX', async () => {
      const t = await ctx.createTicket({ title: '[e2e] bulk model drift' });
      await prisma.ticket.update({ where: { id: t.id }, data: { stage: 'SPECIFY' } });
      const response = await ctx.api.post<{ code: string }>(
        `/api/projects/${ctx.projectId}/tickets/bulk/model`,
        { ticketIds: [t.id], model: 'claude-opus-4-7' }
      );
      expect(response.status).toBe(409);
      expect(response.data.code).toBe('BULK_CONFLICT_STAGE_DRIFT');
    });
  });
});
