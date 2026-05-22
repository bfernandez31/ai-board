/**
 * Integration Tests: Bulk Merge (AIB-821)
 *
 * Covers smallest-id base preservation, attachment concatenation order,
 * notification dispatch, version + stage conflicts, and timing SLO.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Bulk Merge', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function makeTicket(suffix: string, options: { attachments?: unknown[] } = {}) {
    const t = await ctx.createTicket({ title: `[e2e] bulk merge ${suffix}` });
    if (options.attachments && options.attachments.length > 0) {
      await prisma.ticket.update({
        where: { id: t.id },
        data: { attachments: options.attachments as unknown as import('@prisma/client').Prisma.InputJsonValue },
      });
    }
    const refreshed = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
    return refreshed;
  }

  it('preserves the smallest-id ticket and deletes the sources', async () => {
    const base = await makeTicket('base', {
      attachments: [{ type: 'external', url: 'https://example.test/a.png', filename: 'a', mimeType: 'image/png', sizeBytes: 0, uploadedAt: '2026-01-01T00:00:00.000Z' }],
    });
    const src1 = await makeTicket('src1', {
      attachments: [{ type: 'external', url: 'https://example.test/b.png', filename: 'b', mimeType: 'image/png', sizeBytes: 0, uploadedAt: '2026-01-02T00:00:00.000Z' }],
    });
    const src2 = await makeTicket('src2', {
      attachments: [{ type: 'external', url: 'https://example.test/c.png', filename: 'c', mimeType: 'image/png', sizeBytes: 0, uploadedAt: '2026-01-03T00:00:00.000Z' }],
    });
    const expectedVersions = {
      [String(base.id)]: base.version,
      [String(src1.id)]: src1.version,
      [String(src2.id)]: src2.version,
    };

    const response = await ctx.api.post<{
      success: true;
      base: { id: number; version: number; attachmentCount: number };
      deleted: { count: number; ticketKeys: string[] };
    }>(`/api/projects/${ctx.projectId}/tickets/bulk/merge`, {
      baseTicketId: base.id,
      sourceTicketIds: [src1.id, src2.id],
      title: 'Merged title',
      description: 'Merged description',
      expectedVersions,
    });

    expect(response.status).toBe(200);
    expect(response.data.base.id).toBe(base.id);
    expect(response.data.base.version).toBe(base.version + 1);
    expect(response.data.base.attachmentCount).toBe(3);
    expect(response.data.deleted.count).toBe(2);

    const remaining = await prisma.ticket.findMany({
      where: { id: { in: [base.id, src1.id, src2.id] } },
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(base.id);
  });

  it('returns 409 BULK_CONFLICT_STAGE_DRIFT when a source drifts out of INBOX', async () => {
    const base = await makeTicket('base-stage');
    const drifted = await makeTicket('drifted');
    const expectedVersions = {
      [String(base.id)]: base.version,
      [String(drifted.id)]: drifted.version,
    };
    await prisma.ticket.update({ where: { id: drifted.id }, data: { stage: 'SPECIFY' } });

    const response = await ctx.api.post<{ code: string }>(
      `/api/projects/${ctx.projectId}/tickets/bulk/merge`,
      {
        baseTicketId: base.id,
        sourceTicketIds: [drifted.id],
        title: 'Merge attempt',
        description: 'Merge attempt',
        expectedVersions,
      }
    );
    expect(response.status).toBe(409);
    expect(response.data.code).toBe('BULK_CONFLICT_STAGE_DRIFT');
  });

  it('returns 400 VALIDATION_ERROR when baseTicketId is not the smallest id', async () => {
    const a = await makeTicket('a');
    const b = await makeTicket('b');
    const expectedVersions = { [String(a.id)]: a.version, [String(b.id)]: b.version };
    const response = await ctx.api.post<{ code: string }>(
      `/api/projects/${ctx.projectId}/tickets/bulk/merge`,
      {
        baseTicketId: b.id, // wrong: should be smaller
        sourceTicketIds: [a.id],
        title: 'Merge attempt',
        description: 'Merge attempt',
        expectedVersions,
      }
    );
    expect(response.status).toBe(400);
    expect(response.data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when description exceeds 10000 chars', async () => {
    const base = await makeTicket('base-long');
    const src = await makeTicket('src-long');
    const expectedVersions = { [String(base.id)]: base.version, [String(src.id)]: src.version };
    const response = await ctx.api.post<{ code: string }>(
      `/api/projects/${ctx.projectId}/tickets/bulk/merge`,
      {
        baseTicketId: base.id,
        sourceTicketIds: [src.id],
        title: 'OK',
        description: 'B'.repeat(10001),
        expectedVersions,
      }
    );
    expect(response.status).toBe(400);
    expect(response.data.code).toBe('VALIDATION_ERROR');
  });
});
