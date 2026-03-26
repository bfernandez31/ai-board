import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import type { CommandPaletteResponse } from '@/lib/types';

describe('Project Command Palette API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns grouped destination and ticket results', async () => {
    await ctx.createTicket({ title: '[e2e] Board Alpha Ticket' });

    const response = await ctx.api.get<CommandPaletteResponse>(
      `/api/projects/${ctx.projectId}/command-palette?q=boa`
    );

    expect(response.status).toBe(200);
    expect(response.data.groups.destinations.length).toBeGreaterThan(0);
    expect(response.data.groups.tickets.length).toBe(1);
    expect(response.data.groups.tickets[0]?.label).toContain('Board');
  });

  it('validates query parameters', async () => {
    const response = await ctx.api.get<{ error: string }>(
      `/api/projects/${ctx.projectId}/command-palette?limit=99`
    );

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('20');
  });

  it('returns default destination shortcuts for empty queries', async () => {
    const response = await ctx.api.get<CommandPaletteResponse>(
      `/api/projects/${ctx.projectId}/command-palette`
    );

    expect(response.status).toBe(200);
    expect(response.data.groups.destinations.map((result) => result.label)).toEqual([
      'Board',
      'Activity',
      'Analytics',
      'Settings',
    ]);
    expect(response.data.groups.tickets).toEqual([]);
  });

  it('returns empty ticket results when nothing matches', async () => {
    await ctx.createTicket({ title: '[e2e] Another Ticket' });

    const response = await ctx.api.get<CommandPaletteResponse>(
      `/api/projects/${ctx.projectId}/command-palette?q=nomatch`
    );

    expect(response.status).toBe(200);
    expect(response.data.groups.tickets).toEqual([]);
  });

  it('rejects access for a user outside the project', async () => {
    const outsider = await ctx.createUser();
    const prisma = getPrismaClient();

    await prisma.projectMember.deleteMany({
      where: {
        projectId: ctx.projectId,
        userId: outsider.id,
      },
    });

    const response = await ctx.api.get<{ error: string }>(
      `/api/projects/${ctx.projectId}/command-palette?q=board`,
      { testUserId: outsider.id }
    );

    expect(response.status).toBe(403);
    expect(response.data.error).toBe('Access denied');
  });
});
