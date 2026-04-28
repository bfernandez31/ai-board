import { NextRequest } from 'next/server';
import { beforeEach, beforeAll, describe, expect, it } from 'vitest';
import { Stage } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient, getTestUserId } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/tickets/[id]/analysis/route';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

describe('Anchor access filtering and tombstones (US4)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('filters anchors the requesting user cannot access; marks tombstoned anchors', async () => {
    const ticket = await ctx.createTicket({
      title: '[e2e] anchor-filter',
      description: 'demo',
      stage: Stage.INBOX,
    });
    const userId = await getTestUserId();

    // Create another project the test user has no access to
    const otherUser = await prisma.user.upsert({
      where: { email: 'other@anchor.test' },
      update: {},
      create: {
        id: `other-user-${Date.now()}`,
        email: 'other@anchor.test',
        name: 'Other',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });
    const otherProject = await prisma.project.create({
      data: {
        name: '[e2e] other project',
        description: '',
        githubOwner: 'o',
        githubRepo: `r-${Date.now()}`,
        userId: otherUser.id,
        key: `OT${Math.floor(Math.random() * 90 + 10)}`,
        updatedAt: new Date(),
      },
    });
    const inaccessibleTicket = await prisma.ticket.create({
      data: {
        projectId: otherProject.id,
        title: '[e2e] inaccessible-anchor',
        description: 'x',
        stage: Stage.SHIP,
        ticketNumber: 1,
        ticketKey: `OT-1-${Date.now().toString().slice(-6)}`,
        updatedAt: new Date(),
      },
    });

    const accessibleTicket = await ctx.createTicket({
      title: '[e2e] accessible-anchor',
      description: 'x',
      stage: Stage.SHIP,
    });

    const tombstonedTicketId = 9_999_999; // does not exist

    await prisma.ticketAnalysis.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        userId,
        status: 'success',
        startedAt: new Date(),
        endedAt: new Date(),
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        titleSnapshot: '[e2e] anchor-filter',
        descriptionSnapshot: 'demo',
        stackSnapshot: {},
        output: {
          frictionRisk: 'low',
          qualityGateRange: { lower: 80, upper: 95 },
          recommendation: { choice: 'QUICK', confidence: 'medium', justification: 'OK' },
          costRange: { baselineLowerUsd: 0.05, baselineUpperUsd: 0.10, marginalFrictionLowerUsd: 0, marginalFrictionUpperUsd: 0.02 },
          scopeWarnings: [],
          anchors: [
            { ticketId: accessibleTicket.id, ticketKey: 'AIB-1', frictionFree: true, qualityScore: 88, overlapStrength: 2 },
            { ticketId: inaccessibleTicket.id, ticketKey: 'OTH-1', frictionFree: true, qualityScore: 80, overlapStrength: 1 },
            { ticketId: tombstonedTicketId, ticketKey: 'OTH-2', frictionFree: false, qualityScore: 50, overlapStrength: 1 },
          ],
        },
      },
    });

    const res = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/tickets/${ticket.id}/analysis`,
        { headers: ctx.api.getHeaders() }
      ),
      {
        params: Promise.resolve({
          projectId: String(ctx.projectId),
          id: String(ticket.id),
        }),
      }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      latest: { output: { anchors: Array<{ ticketId: number; tombstoned: boolean }> } };
    };
    const anchors = body.latest.output.anchors;
    const ticketIds = anchors.map((a) => a.ticketId);
    expect(ticketIds).toContain(accessibleTicket.id);
    expect(ticketIds).not.toContain(inaccessibleTicket.id);
    expect(ticketIds).not.toContain(tombstonedTicketId);

    await prisma.project.delete({ where: { id: otherProject.id } });
  });
});
