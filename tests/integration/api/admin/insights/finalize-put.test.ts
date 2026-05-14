import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const { uploadInsightsReportArtifact, validateWorkflowAuth } = vi.hoisted(
  () => ({
    uploadInsightsReportArtifact: vi.fn(),
    validateWorkflowAuth: vi.fn(),
  })
);

vi.mock('@/app/lib/blob/client', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, uploadInsightsReportArtifact };
});

vi.mock('@/app/lib/auth/workflow-auth', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, validateWorkflowAuth };
});

import { PUT } from '@/app/api/admin/insights/reports/[id]/finalize/route';
import { buildInsightsReportKey } from '@/app/lib/insights/blob-keys';

const VALID_HTML = `<!DOCTYPE html><html><body>
<h2 id="section-wins">Wins</h2><h2 id="section-horizon">Horizon</h2><h2 id="section-friction">Friction</h2><h3>Suggested CLAUDE.md Additions</h3>
</body></html>`;

function makeRequest(id: number, ct: string, bodyBytes: Uint8Array): NextRequest {
  return new NextRequest(
    `http://localhost/api/admin/insights/reports/${id}/finalize`,
    {
      method: 'PUT',
      body: bodyBytes,
      headers: {
        'Content-Type': ct,
        Authorization: 'Bearer test-token',
      },
    }
  );
}

describe('PUT /api/admin/insights/reports/:id/finalize (US3)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();
  let reportId: number;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    uploadInsightsReportArtifact.mockReset();
    validateWorkflowAuth.mockReset();
    validateWorkflowAuth.mockReturnValue({ isValid: true });
    uploadInsightsReportArtifact.mockResolvedValue({
      key: 'placeholder',
      size: 1,
    });
    await prisma.insightsReport.deleteMany({});
    ctx;

    const row = await prisma.insightsReport.create({
      data: {
        status: 'RUNNING',
        generatedAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
      },
    });
    reportId = row.id;
  });

  it('rejects unauthorized callers', async () => {
    validateWorkflowAuth.mockReturnValueOnce({ isValid: false });
    const res = await PUT(
      makeRequest(reportId, 'text/html', new TextEncoder().encode('x')),
      { params: Promise.resolve({ id: String(reportId) }) }
    );
    expect(res.status).toBe(401);
  });

  it('returns 415 for non-text/html content-type', async () => {
    const res = await PUT(
      makeRequest(reportId, 'application/json', new TextEncoder().encode('{}')),
      { params: Promise.resolve({ id: String(reportId) }) }
    );
    expect(res.status).toBe(415);
    expect(uploadInsightsReportArtifact).not.toHaveBeenCalled();
  });

  it('returns 422 INVALID_OUTPUT when validation fails (no upload happens)', async () => {
    const res = await PUT(
      makeRequest(
        reportId,
        'text/html; charset=utf-8',
        new TextEncoder().encode('<html>not valid</html>')
      ),
      { params: Promise.resolve({ id: String(reportId) }) }
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('INVALID_OUTPUT');
    expect(uploadInsightsReportArtifact).not.toHaveBeenCalled();
  });

  it('uploads and returns deterministic artifactKey on success', async () => {
    const res = await PUT(
      makeRequest(
        reportId,
        'text/html; charset=utf-8',
        new TextEncoder().encode(VALID_HTML)
      ),
      { params: Promise.resolve({ id: String(reportId) }) }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { artifactKey: string; artifactSize: number };
    expect(body.artifactKey).toBe(buildInsightsReportKey(reportId));
    expect(body.artifactSize).toBeGreaterThan(0);
    expect(uploadInsightsReportArtifact).toHaveBeenCalledTimes(1);
  });

  it('returns 404 JSON when the report row is missing (workflow endpoint — not FR-003)', async () => {
    const res = await PUT(
      makeRequest(
        999999,
        'text/html; charset=utf-8',
        new TextEncoder().encode(VALID_HTML)
      ),
      { params: Promise.resolve({ id: '999999' }) }
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Not Found');
  });
});
