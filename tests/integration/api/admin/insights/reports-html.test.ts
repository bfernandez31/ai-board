import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const { streamInsightsReportArtifact, requireAdminOrNotFound } = vi.hoisted(
  () => ({
    streamInsightsReportArtifact: vi.fn(),
    requireAdminOrNotFound: vi.fn(),
  })
);

vi.mock('@/app/lib/blob/client', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    streamInsightsReportArtifact,
  };
});

vi.mock('@/app/lib/auth/admin', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    requireAdminOrNotFound,
  };
});

import { GET } from '@/app/api/admin/insights/reports/[id]/html/route';
import { buildInsightsReportKey } from '@/app/lib/insights/blob-keys';

function makeRequest(id: number): NextRequest {
  return new NextRequest(`http://localhost/api/admin/insights/reports/${id}/html`);
}

describe('GET /api/admin/insights/reports/:id/html (US1, AIB-791)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    streamInsightsReportArtifact.mockReset();
    requireAdminOrNotFound.mockReset();
    await prisma.insightsReport.deleteMany({});
  });

  it('returns byte-equivalent 404 for non-admin caller', async () => {
    requireAdminOrNotFound.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    });

    const res = await GET(makeRequest(1), {
      params: Promise.resolve({ id: '1' }),
    });

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toBe('');
  });

  it('streams a COMPLETED report with the expected CSP headers', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const now = new Date();
    const row = await prisma.insightsReport.create({
      data: {
        status: 'COMPLETED',
        generatedAt: now,
        periodStart: new Date(now.getTime() - 86_400_000),
        periodEnd: now,
        sessionsCount: 10,
        ticketsCount: 3,
        artifactKey: 'tmp/placeholder.html',
        artifactSize: 1234,
        completedAt: now,
      },
    });
    const artifactKey = buildInsightsReportKey(row.id);
    await prisma.insightsReport.update({
      where: { id: row.id },
      data: { artifactKey },
    });
    ctx; // satisfy linter — keep TestContext seeding hook

    streamInsightsReportArtifact.mockResolvedValueOnce({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('<html>hello</html>'));
          controller.close();
        },
      }),
      contentType: 'text/html; charset=utf-8',
      size: 18,
    });

    const res = await GET(makeRequest(row.id), {
      params: Promise.resolve({ id: String(row.id) }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'self'");
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=300');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBeNull();
    expect(await res.text()).toBe('<html>hello</html>');
  });

  it('returns byte-equivalent 404 for a non-COMPLETED row', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const row = await prisma.insightsReport.create({
      data: {
        status: 'FAILED',
        generatedAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
        errorReason: 'boom',
      },
    });

    const res = await GET(makeRequest(row.id), {
      params: Promise.resolve({ id: String(row.id) }),
    });

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
  });

  it('serves the FR-024 placeholder when blob returns 404', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const now = new Date();
    const row = await prisma.insightsReport.create({
      data: {
        status: 'COMPLETED',
        generatedAt: now,
        periodStart: now,
        periodEnd: now,
        sessionsCount: 1,
        ticketsCount: 1,
        artifactKey: 'insights/reports/missing.html',
        artifactSize: 1,
        completedAt: now,
      },
    });

    streamInsightsReportArtifact.mockResolvedValueOnce(null);

    const res = await GET(makeRequest(row.id), {
      params: Promise.resolve({ id: String(row.id) }),
    });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('Report content is no longer available');
  });
});
