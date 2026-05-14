import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const { streamInsightsReportArtifact, validateWorkflowAuth } = vi.hoisted(
  () => ({
    streamInsightsReportArtifact: vi.fn(),
    validateWorkflowAuth: vi.fn(),
  })
);

vi.mock('@/app/lib/blob/client', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, streamInsightsReportArtifact };
});

vi.mock('@/app/lib/auth/workflow-auth', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, validateWorkflowAuth };
});

import { PATCH } from '@/app/api/admin/insights/reports/[id]/status/route';
import { buildInsightsReportKey } from '@/app/lib/insights/blob-keys';

function makeRequest(id: number, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/admin/insights/reports/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
    }
  );
}

function streamFromString(s: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(s));
      controller.close();
    },
  });
}

const VALID_HTML = [
  '<!DOCTYPE html><html><body>',
  '<h2 id="section-wins">Wins</h2><h2 id="section-horizon">Horizon</h2>',
  '<h2 id="section-friction">Friction</h2><h3>Suggested CLAUDE.md Additions</h3>',
  '</body></html>',
].join('');

describe('PATCH /api/admin/insights/reports/:id/status (US3 / SC-012)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    streamInsightsReportArtifact.mockReset();
    validateWorkflowAuth.mockReset();
    validateWorkflowAuth.mockReturnValue({ isValid: true });
    await prisma.insightsReport.deleteMany({});
    ctx;
  });

  it('rejects unauthorized workflow callers', async () => {
    validateWorkflowAuth.mockReturnValueOnce({ isValid: false });
    const res = await PATCH(makeRequest(1, { status: 'COMPLETED' }), {
      params: Promise.resolve({ id: '1' }),
    });
    expect(res.status).toBe(401);
  });

  it('atomically completes a RUNNING row when validation passes', async () => {
    const row = await prisma.insightsReport.create({
      data: {
        status: 'RUNNING',
        generatedAt: new Date(),
        periodStart: new Date(Date.now() - 86_400_000),
        periodEnd: new Date(),
      },
    });
    streamInsightsReportArtifact.mockResolvedValueOnce({
      stream: streamFromString(VALID_HTML),
      contentType: 'text/html; charset=utf-8',
      size: VALID_HTML.length,
    });

    const res = await PATCH(
      makeRequest(row.id, {
        status: 'COMPLETED',
        sessionsCount: 5,
        ticketsCount: 2,
        artifactKey: buildInsightsReportKey(row.id),
        artifactSize: VALID_HTML.length,
      }),
      { params: Promise.resolve({ id: String(row.id) }) }
    );
    expect(res.status).toBe(200);
    const persisted = await prisma.insightsReport.findUnique({ where: { id: row.id } });
    expect(persisted?.status).toBe('COMPLETED');
    expect(persisted?.sessionsCount).toBe(5);
  });

  it('overrides COMPLETED to FAILED when server-side validation fails', async () => {
    const row = await prisma.insightsReport.create({
      data: {
        status: 'RUNNING',
        generatedAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
      },
    });
    streamInsightsReportArtifact.mockResolvedValueOnce({
      stream: streamFromString('<html>not valid</html>'),
      contentType: 'text/html; charset=utf-8',
      size: 22,
    });

    const res = await PATCH(
      makeRequest(row.id, {
        status: 'COMPLETED',
        sessionsCount: 1,
        ticketsCount: 1,
        artifactKey: buildInsightsReportKey(row.id),
        artifactSize: 100,
      }),
      { params: Promise.resolve({ id: String(row.id) }) }
    );
    expect(res.status).toBe(200);
    const persisted = await prisma.insightsReport.findUnique({ where: { id: row.id } });
    expect(persisted?.status).toBe('FAILED');
    expect(persisted?.errorReason).toMatch(/validation failed/);
  });

  it('is idempotent: late callback against an already-FAILED row is a no-op', async () => {
    const row = await prisma.insightsReport.create({
      data: {
        status: 'FAILED',
        generatedAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
        errorReason: 'previously failed',
        completedAt: new Date(),
      },
    });

    const res = await PATCH(
      makeRequest(row.id, {
        status: 'COMPLETED',
        sessionsCount: 1,
        ticketsCount: 1,
        artifactKey: buildInsightsReportKey(row.id),
        artifactSize: 100,
      }),
      { params: Promise.resolve({ id: String(row.id) }) }
    );
    expect(res.status).toBe(200);
    const persisted = await prisma.insightsReport.findUnique({ where: { id: row.id } });
    expect(persisted?.status).toBe('FAILED');
    expect(persisted?.errorReason).toBe('previously failed');
  });
});
