/**
 * Integration Tests: Token saving (AIB-849)
 *
 * Covers:
 *  - PATCH /api/projects/:projectId           (project default; owner-only)  [T006]
 *  - PATCH /api/projects/:projectId/tickets/:id/token-saving (override)      [T021]
 *  - clone-carry of the ticket override (duplicate + full clone)            [T021]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createTestMemberUser, addProjectMember } from '@/tests/helpers/db-setup';
import { duplicateTicket, fullCloneTicket } from '@/lib/db/tickets';

describe('Token saving — project default (AIB-849, T006)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { tokenSaving: false },
    });
  });

  it('owner can enable tokenSaving via PATCH (200, persists)', async () => {
    const response = await ctx.api.patch<{ tokenSaving: boolean }>(
      `/api/projects/${ctx.projectId}`,
      { tokenSaving: true }
    );

    expect(response.status).toBe(200);
    expect(response.data.tokenSaving).toBe(true);

    const db = await prisma.project.findUnique({ where: { id: ctx.projectId } });
    expect(db?.tokenSaving).toBe(true);
  });

  it('non-owner member receives 403 FORBIDDEN', async () => {
    const member = await createTestMemberUser();
    await addProjectMember(ctx.projectId, member.id).catch(() => {
      // ignore if the membership already exists from a prior run
    });

    const response = await ctx.api.patch<{ code?: string }>(
      `/api/projects/${ctx.projectId}`,
      { tokenSaving: true },
      { testUserId: member.id }
    );

    expect(response.status).toBe(403);
    expect(response.data.code).toBe('FORBIDDEN');

    const db = await prisma.project.findUnique({ where: { id: ctx.projectId } });
    expect(db?.tokenSaving).toBe(false);
  });
});

describe('Token saving — ticket override endpoint (AIB-849, T021)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('persists true, false, and null (clear override)', async () => {
    const ticket = await ctx.createTicket();
    let version = 1;

    const on = await ctx.api.patch<{ tokenSaving: boolean | null; version: number }>(
      `/api/projects/${ctx.projectId}/tickets/${ticket.id}/token-saving`,
      { tokenSaving: true, version }
    );
    expect(on.status).toBe(200);
    expect(on.data.tokenSaving).toBe(true);
    version = on.data.version;

    const off = await ctx.api.patch<{ tokenSaving: boolean | null; version: number }>(
      `/api/projects/${ctx.projectId}/tickets/${ticket.id}/token-saving`,
      { tokenSaving: false, version }
    );
    expect(off.status).toBe(200);
    expect(off.data.tokenSaving).toBe(false);
    version = off.data.version;

    const cleared = await ctx.api.patch<{ tokenSaving: boolean | null; version: number }>(
      `/api/projects/${ctx.projectId}/tickets/${ticket.id}/token-saving`,
      { tokenSaving: null, version }
    );
    expect(cleared.status).toBe(200);
    expect(cleared.data.tokenSaving).toBeNull();

    const db = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(db?.tokenSaving).toBeNull();
  });

  it('is editable past INBOX (no stage gate)', async () => {
    const ticket = await ctx.createTicket({ stage: 'PLAN' });

    const response = await ctx.api.patch<{ tokenSaving: boolean | null }>(
      `/api/projects/${ctx.projectId}/tickets/${ticket.id}/token-saving`,
      { tokenSaving: true, version: 1 }
    );

    expect(response.status).toBe(200);
    expect(response.data.tokenSaving).toBe(true);
  });

  it('returns 409 ACTIVE_RUN when a RUNNING job exists on the ticket', async () => {
    const ticket = await ctx.createTicket({ stage: 'BUILD' });
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: 'RUNNING',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await ctx.api.patch<{ code?: string }>(
      `/api/projects/${ctx.projectId}/tickets/${ticket.id}/token-saving`,
      { tokenSaving: true, version: 1 }
    );

    expect(response.status).toBe(409);
    expect(response.data.code).toBe('ACTIVE_RUN');
  });

  it('returns 409 VERSION_CONFLICT for a stale version', async () => {
    const ticket = await ctx.createTicket();

    const response = await ctx.api.patch<{ code?: string }>(
      `/api/projects/${ctx.projectId}/tickets/${ticket.id}/token-saving`,
      { tokenSaving: true, version: 999 }
    );

    expect(response.status).toBe(409);
    expect(response.data.code).toBe('VERSION_CONFLICT');
  });
});

describe('Token saving — clone carry (AIB-849, T021)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('simple copy (duplicateTicket) carries the tokenSaving override', async () => {
    const ticket = await ctx.createTicket();
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { tokenSaving: true },
    });

    const copy = await duplicateTicket(ctx.projectId, ticket.id);
    expect(copy.tokenSaving).toBe(true);
  });

  it('full clone (fullCloneTicket) carries the tokenSaving override', async () => {
    const ticket = await ctx.createTicket({ stage: 'BUILD' });
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { tokenSaving: false, branch: 'feature/source-branch' },
    });

    const { getNextTicketNumber } = await import('@/app/lib/db/ticket-sequence');
    const nextNumber = await getNextTicketNumber(ctx.projectId);
    const clone = await fullCloneTicket(
      ctx.projectId,
      ticket.id,
      'feature/clone-branch',
      nextNumber
    );
    expect(clone.tokenSaving).toBe(false);
  });
});
