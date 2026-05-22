/**
 * Integration Tests: Bulk Action Notifications (AIB-821)
 *
 * Asserts that TICKET_DELETED and TICKET_MERGED notifications are created
 * for non-actor creators only, with the expected fields populated.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const ACTOR_ID = 'test-user-id';

describe('Bulk action notifications', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function makeRecipient(suffix: string) {
    const email = `bulk-notify-${Date.now()}-${suffix}@e2e.local`;
    return prisma.user.create({
      data: {
        id: `user-${Date.now()}-${suffix}`,
        email,
        name: `User ${suffix}`,
        updatedAt: new Date(),
      },
    });
  }

  it('creates TICKET_DELETED notifications for non-actor creators only', async () => {
    const recipient = await makeRecipient('del');
    const ticketSelf = await ctx.createTicket({ title: '[e2e] bulk delete notify self' });
    const ticketOther = await ctx.createTicket({ title: '[e2e] bulk delete notify other' });

    await prisma.ticket.update({
      where: { id: ticketSelf.id },
      data: { creatorId: ACTOR_ID },
    });
    await prisma.ticket.update({
      where: { id: ticketOther.id },
      data: { creatorId: recipient.id },
    });
    const rows = await prisma.ticket.findMany({
      where: { id: { in: [ticketSelf.id, ticketOther.id] } },
    });
    const expectedVersions: Record<string, number> = {};
    for (const r of rows) expectedVersions[String(r.id)] = r.version;

    const response = await ctx.api.post<{
      success: true;
      notifiedCreatorIds: string[];
    }>(`/api/projects/${ctx.projectId}/tickets/bulk/delete`, {
      ticketIds: [ticketSelf.id, ticketOther.id],
      expectedVersions,
    });
    expect(response.status).toBe(200);
    expect(response.data.notifiedCreatorIds).toEqual([recipient.id]);

    const notifications = await prisma.notification.findMany({
      where: { recipientId: recipient.id, type: 'TICKET_DELETED' },
      orderBy: { id: 'desc' },
      take: 1,
    });
    expect(notifications).toHaveLength(1);
    const n = notifications[0]!;
    expect(n.actorId).toBe(ACTOR_ID);
    expect(n.commentId).toBeNull();
    expect(n.ticketKeySnapshot).toBeTruthy();
  });

  it('creates TICKET_MERGED notifications with mergedIntoTicketId', async () => {
    const recipient = await makeRecipient('mrg');
    const base = await ctx.createTicket({ title: '[e2e] bulk merge notify base' });
    const src = await ctx.createTicket({ title: '[e2e] bulk merge notify src' });

    await prisma.ticket.update({ where: { id: src.id }, data: { creatorId: recipient.id } });
    const rows = await prisma.ticket.findMany({
      where: { id: { in: [base.id, src.id] } },
    });
    const expectedVersions: Record<string, number> = {};
    for (const r of rows) expectedVersions[String(r.id)] = r.version;

    const response = await ctx.api.post<{
      success: true;
      notifiedCreatorIds: string[];
    }>(`/api/projects/${ctx.projectId}/tickets/bulk/merge`, {
      baseTicketId: base.id,
      sourceTicketIds: [src.id],
      title: 'merged',
      description: 'merged desc',
      expectedVersions,
    });
    expect(response.status).toBe(200);
    expect(response.data.notifiedCreatorIds).toEqual([recipient.id]);

    const notifications = await prisma.notification.findMany({
      where: { recipientId: recipient.id, type: 'TICKET_MERGED' },
      orderBy: { id: 'desc' },
      take: 1,
    });
    expect(notifications).toHaveLength(1);
    const n = notifications[0]!;
    expect(n.mergedIntoTicketId).toBe(base.id);
    expect(n.ticketKeySnapshot).toBeTruthy();
    expect(n.ticketId).toBeNull();
  });
});
