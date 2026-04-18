import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/activity-heatmap/route';

vi.mock('@/lib/db/users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/users')>();
  return {
    ...actual,
    getCurrentUserOrToken: vi.fn(),
  };
});

const { getCurrentUserOrToken } = await import('@/lib/db/users');

describe('GET /api/activity-heatmap', () => {
  const prisma = getPrismaClient();
  let userId: string;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    userId = `heatmap-route-user-${suffix}`;
    await prisma.user.create({
      data: {
        id: userId,
        email: `heatmap-route-${suffix}@project.e2e.test`,
        name: 'Heatmap Route Test User',
        emailVerified: new Date(),
        updatedAt: new Date(),
        createdAt: new Date(Date.UTC(2023, 0, 1)),
      },
    });
    vi.mocked(getCurrentUserOrToken).mockResolvedValue({
      id: userId,
      email: `heatmap-route-${suffix}@project.e2e.test`,
      source: 'session',
    });
  });

  afterEach(async () => {
    vi.mocked(getCurrentUserOrToken).mockReset();
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('returns heatmap data for the default rolling period', async () => {
    const request = new NextRequest('http://localhost/api/activity-heatmap');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      filters: { period: string; agent: string };
      days: unknown[];
    };
    expect(data.filters).toEqual({ period: 'last-12m', agent: 'all' });
    expect(Array.isArray(data.days)).toBe(true);
  });

  it('rejects invalid period values with 400', async () => {
    const request = new NextRequest('http://localhost/api/activity-heatmap?period=banana');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Invalid heatmap filters');
  });

  it('returns 401 when the auth helper rejects the caller', async () => {
    vi.mocked(getCurrentUserOrToken).mockRejectedValueOnce(new Error('Invalid token'));

    const request = new NextRequest('http://localhost/api/activity-heatmap');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when the authenticated user row is missing', async () => {
    vi.mocked(getCurrentUserOrToken).mockResolvedValueOnce({
      id: 'nonexistent-user-id',
      email: 'nobody@example.test',
      source: 'session',
    });

    const request = new NextRequest('http://localhost/api/activity-heatmap');
    const response = await GET(request);

    expect(response.status).toBe(404);
  });
});
