import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createTestTicket } from '@/tests/helpers/db-setup';

describe('Launch Comparison API - POST /api/projects/:projectId/comparisons/launch', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('creates a job and returns 201 for valid VERIFY-stage tickets', async () => {
    const ticket1 = await createTestTicket(ctx.projectId, {
      title: '[e2e] Verify Ticket 1',
      description: 'First verify ticket',
      ticketNumber: 501,
      ticketKey: 'TE2-501',
      stage: 'VERIFY',
      branch: 'AIB-501-feature',
    });
    const ticket2 = await createTestTicket(ctx.projectId, {
      title: '[e2e] Verify Ticket 2',
      description: 'Second verify ticket',
      ticketNumber: 502,
      ticketKey: 'TE2-502',
      stage: 'VERIFY',
      branch: 'AIB-502-feature',
    });

    const response = await ctx.api.post<{
      jobId: number;
      status: string;
      sourceTicketKey: string;
      participantTicketKeys: string[];
    }>(`/api/projects/${ctx.projectId}/comparisons/launch`, {
      ticketIds: [ticket1.id, ticket2.id],
    });

    expect(response.status).toBe(201);
    expect(response.data.status).toBe('PENDING');
    expect(response.data.jobId).toBeGreaterThan(0);
    expect(response.data.sourceTicketKey).toBe('TE2-501');
    expect(response.data.participantTicketKeys).toContain('TE2-501');
    expect(response.data.participantTicketKeys).toContain('TE2-502');
  });

  it('returns 400 when fewer than 2 tickets are provided', async () => {
    const ticket1 = await createTestTicket(ctx.projectId, {
      title: '[e2e] Solo Ticket',
      description: 'Only one ticket',
      ticketNumber: 503,
      ticketKey: 'TE2-503',
      stage: 'VERIFY',
      branch: 'AIB-503-feature',
    });

    const response = await ctx.api.post<{ error: string }>(
      `/api/projects/${ctx.projectId}/comparisons/launch`,
      { ticketIds: [ticket1.id] }
    );

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('2 tickets');
  });

  it('returns 400 when a ticket is not in VERIFY stage', async () => {
    const verifyTicket = await createTestTicket(ctx.projectId, {
      title: '[e2e] Verify Ticket',
      description: 'In verify',
      ticketNumber: 504,
      ticketKey: 'TE2-504',
      stage: 'VERIFY',
      branch: 'AIB-504-feature',
    });
    const buildTicket = await createTestTicket(ctx.projectId, {
      title: '[e2e] Build Ticket',
      description: 'In build',
      ticketNumber: 505,
      ticketKey: 'TE2-505',
      stage: 'BUILD',
      branch: 'AIB-505-feature',
    });

    const response = await ctx.api.post<{ error: string }>(
      `/api/projects/${ctx.projectId}/comparisons/launch`,
      { ticketIds: [verifyTicket.id, buildTicket.id] }
    );

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('not in VERIFY stage');
  });

  it('returns 400 when a ticket has no branch', async () => {
    const ticket1 = await createTestTicket(ctx.projectId, {
      title: '[e2e] Branch Ticket',
      description: 'Has branch',
      ticketNumber: 506,
      ticketKey: 'TE2-506',
      stage: 'VERIFY',
      branch: 'AIB-506-feature',
    });
    const ticket2 = await createTestTicket(ctx.projectId, {
      title: '[e2e] No Branch Ticket',
      description: 'No branch',
      ticketNumber: 507,
      ticketKey: 'TE2-507',
      stage: 'VERIFY',
    });

    const response = await ctx.api.post<{ error: string }>(
      `/api/projects/${ctx.projectId}/comparisons/launch`,
      { ticketIds: [ticket1.id, ticket2.id] }
    );

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('no branch');
  });

  it('returns 404 when a ticket does not exist', async () => {
    const ticket1 = await createTestTicket(ctx.projectId, {
      title: '[e2e] Real Ticket',
      description: 'Exists',
      ticketNumber: 508,
      ticketKey: 'TE2-508',
      stage: 'VERIFY',
      branch: 'AIB-508-feature',
    });

    const response = await ctx.api.post<{ error: string }>(
      `/api/projects/${ctx.projectId}/comparisons/launch`,
      { ticketIds: [ticket1.id, 999999] }
    );

    expect(response.status).toBe(404);
    expect(response.data.error).toContain('Ticket not found');
  });

  it('returns 401 for unauthorized user', async () => {
    const response = await ctx.api.post<{ error: string }>(
      `/api/projects/${ctx.projectId}/comparisons/launch`,
      { ticketIds: [1, 2] },
      { includeTestUserHeader: false, enableTestAuthOverride: false }
    );

    expect(response.status).toBe(401);
  });
});
