/**
 * Integration test for T035 (US6 / SC-007).
 *
 * Owner-only API gate. Owner gets 200 with payload; member and non-member get
 * 404 with byte-identical body. Unauthenticated callers get 401. Invalid
 * projectId returns 400.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { GET } from '@/app/api/projects/[projectId]/calibration/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectOwnership: vi.fn(),
}));

import { verifyProjectOwnership } from '@/lib/db/auth-helpers';

const mockVerify = verifyProjectOwnership as unknown as ReturnType<typeof vi.fn>;

function makeRequest(url = 'http://localhost/api/projects/1/calibration'): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

async function callRoute(projectIdStr: string, request: NextRequest) {
  return GET(request, { params: Promise.resolve({ projectId: projectIdStr }) });
}

describe('Calibration API route (US6, SC-007)', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    mockVerify.mockReset();
  });

  it('returns 200 with CalibrationDashboardData for the project owner', async () => {
    mockVerify.mockResolvedValueOnce({
      id: ctx.projectId,
      name: '[e2e] Test',
      githubOwner: 'owner',
      githubRepo: 'repo',
      clarificationPolicy: 'AUTO',
      defaultBranch: 'main',
    });

    const res = await callRoute(String(ctx.projectId), makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('windowSize');
    expect(body).toHaveProperty('confusionMatrix');
    expect(body).toHaveProperty('qualityDistribution');
    expect(body).toHaveProperty('costDistribution');
    expect(body).toHaveProperty('recommendation');
    expect(body).toHaveProperty('adoption');
    expect(body).toHaveProperty('generatedAt');
  });

  it('returns 404 {error: "Not found"} when caller is a member (not owner)', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Project not found'));
    const res = await callRoute(String(ctx.projectId), makeRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Not found' });
  });

  it('returns 404 indistinguishable from member for non-member', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Project not found'));
    const res = await callRoute(String(ctx.projectId), makeRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Not found' });
  });

  it('returns 401 {error: "Unauthorized"} when caller is unauthenticated', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await callRoute(String(ctx.projectId), makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when projectId is invalid', async () => {
    const res = await callRoute('not-a-number', makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid project ID' });
  });
});
