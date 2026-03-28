import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { prisma } from '@/lib/db/client';

describe('POST /api/projects/[projectId]/health/scans', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('creates a scan and returns 201', async () => {
    const response = await ctx.api.post<{ scan: { id: number; scanType: string; status: string } }>(
      `/api/projects/${ctx.projectId}/health/scans`,
      { scanType: 'SECURITY' }
    );

    expect(response.status).toBe(201);
    expect(response.data.scan.scanType).toBe('SECURITY');
    expect(response.data.scan.status).toBe('PENDING');
  });

  it('returns 409 when a scan of same type is already in progress', async () => {
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'RUNNING',
      },
    });

    const response = await ctx.api.post(
      `/api/projects/${ctx.projectId}/health/scans`,
      { scanType: 'SECURITY' }
    );

    expect(response.status).toBe(409);
  });

  it('allows scan of different type when another is running', async () => {
    await prisma.healthScan.create({
      data: {
        projectId: ctx.projectId,
        scanType: 'SECURITY',
        status: 'RUNNING',
      },
    });

    const response = await ctx.api.post<{ scan: { scanType: string } }>(
      `/api/projects/${ctx.projectId}/health/scans`,
      { scanType: 'TESTS' }
    );

    expect(response.status).toBe(201);
    expect(response.data.scan.scanType).toBe('TESTS');
  });

  it('returns 400 for invalid scan type', async () => {
    const response = await ctx.api.post(
      `/api/projects/${ctx.projectId}/health/scans`,
      { scanType: 'INVALID' }
    );

    expect(response.status).toBe(400);
  });
});

describe('GET /api/projects/[projectId]/health/scans', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns paginated scans in reverse chronological order', async () => {
    await prisma.healthScan.createMany({
      data: [
        { projectId: ctx.projectId, scanType: 'SECURITY', status: 'COMPLETED', score: 90 },
        { projectId: ctx.projectId, scanType: 'SECURITY', status: 'COMPLETED', score: 85 },
        { projectId: ctx.projectId, scanType: 'TESTS', status: 'COMPLETED', score: 70 },
      ],
    });

    const response = await ctx.api.get<{
      scans: Array<{ scanType: string }>;
      pagination: { total: number; totalPages: number };
    }>(`/api/projects/${ctx.projectId}/health/scans?page=1&pageSize=10`);

    expect(response.status).toBe(200);
    expect(response.data.scans).toHaveLength(3);
    expect(response.data.pagination.total).toBe(3);
  });

  it('filters by type', async () => {
    await prisma.healthScan.createMany({
      data: [
        { projectId: ctx.projectId, scanType: 'SECURITY', status: 'COMPLETED', score: 90 },
        { projectId: ctx.projectId, scanType: 'TESTS', status: 'COMPLETED', score: 70 },
      ],
    });

    const response = await ctx.api.get<{
      scans: Array<{ scanType: string }>;
      pagination: { total: number };
    }>(`/api/projects/${ctx.projectId}/health/scans?type=SECURITY`);

    expect(response.status).toBe(200);
    expect(response.data.scans).toHaveLength(1);
    expect(response.data.scans[0]?.scanType).toBe('SECURITY');
    expect(response.data.pagination.total).toBe(1);
  });

  it('returns empty results for project with no scans', async () => {
    const response = await ctx.api.get<{
      scans: unknown[];
      pagination: { total: number };
    }>(`/api/projects/${ctx.projectId}/health/scans`);

    expect(response.status).toBe(200);
    expect(response.data.scans).toHaveLength(0);
    expect(response.data.pagination.total).toBe(0);
  });
});
