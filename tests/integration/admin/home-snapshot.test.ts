import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { requireAdminOrNotFoundMock } = vi.hoisted(() => ({
  requireAdminOrNotFoundMock: vi.fn(),
}));

vi.mock('@/app/lib/auth/admin', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, requireAdminOrNotFound: requireAdminOrNotFoundMock };
});

const mockBuildSnapshot = vi.fn();
vi.mock('@/lib/admin/home/snapshot', () => ({
  buildSnapshot: mockBuildSnapshot,
}));

import { GET } from '@/app/api/admin/home/route';

const EXAMPLE_SNAPSHOT = {
  generatedAt: '2026-05-12T10:00:00.000Z',
  alerts: [
    { kind: 'LOW_SUCCESS_RATE', message: 'Job success rate 78%', href: '/admin/insights' },
  ],
  pulse: {
    users: { value: 100, delta7d: 5, delta30d: 20, spark: Array.from({ length: 30 }, (_, i) => ({ d: `2026-04-${String(i + 1).padStart(2, '0')}`, v: i })) },
    mau: { value: 50, deltaPrev30d: 3, shareOfBase: 0.5, spark: Array.from({ length: 30 }, (_, i) => ({ d: `2026-04-${String(i + 1).padStart(2, '0')}`, v: i })) },
    mrr: { valueUsd: 6000, deltaUsdThisMonth: 500, proCount: 2, teamCount: 1, proUsd: 3000, teamUsd: 3000, spark: Array.from({ length: 30 }, (_, i) => ({ d: `2026-04-${String(i + 1).padStart(2, '0')}`, v: i })) },
    activePaying: { value: 3, delta30d: 1, conversionRate: 0.03, spark: Array.from({ length: 30 }, (_, i) => ({ d: `2026-04-${String(i + 1).padStart(2, '0')}`, v: i })) },
  },
  business: {
    planDistribution: [
      { plan: 'FREE', count: 97 },
      { plan: 'PRO', count: 2 },
      { plan: 'TEAM', count: 1 },
    ],
    activationFunnel: {
      cohortSize: 10,
      steps: [
        { key: 'SIGNUP', count: 10, stepRate: null },
        { key: 'FIRST_PROJECT', count: 7, stepRate: 0.7 },
        { key: 'FIRST_JOB', count: 5, stepRate: 0.714 },
        { key: 'FIRST_PAID', count: 1, stepRate: 0.2 },
      ],
    },
    churn: { cancellations: 0, downgrades: 0, mrrLostUsd: 0, netMrrDeltaUsd: 500 },
  },
  trends: {
    signupsDaily: Array.from({ length: 30 }, (_, i) => ({ d: `2026-04-${String(i + 1).padStart(2, '0')}`, v: i })),
    jobsDaily: Array.from({ length: 30 }, (_, i) => ({ d: `2026-04-${String(i + 1).padStart(2, '0')}`, completed: i * 3, failed: 0 })),
    mrrMonthly: [{ m: '2026-04', v: 5500 }, { m: '2026-05', v: 6000 }],
  },
  tables: {
    newPaying: [{ email: 'a@b.co', plan: 'PRO', accountAgeDays: 30, subscribedAt: '2026-05-01T00:00:00.000Z' }],
    cancellations: [],
    topUsers: [{ email: 'u@u.co', plan: 'PRO', jobsThisMonth: 10 }],
    topProjects: [{ projectKey: 'TST', ownerEmail: 'u@u.co', jobsThisMonth: 10 }],
  },
};

describe('GET /api/admin/home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 for non-admin callers', async () => {
    const { adminNotFoundResponse } = await import('@/app/lib/auth/admin');
    requireAdminOrNotFoundMock.mockResolvedValue({ ok: false, response: adminNotFoundResponse() });

    const res = await GET(new NextRequest('http://localhost/api/admin/home'));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
  });

  it('returns snapshot JSON for admin callers with Cache-Control: no-store', async () => {
    requireAdminOrNotFoundMock.mockResolvedValue({ ok: true, email: 'admin@example.com' });
    mockBuildSnapshot.mockResolvedValue(EXAMPLE_SNAPSHOT);

    const res = await GET(new NextRequest('http://localhost/api/admin/home'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');

    const data = await res.json();
    expect(data.generatedAt).toBeTruthy();
    expect(typeof data.generatedAt).toBe('string');
  });

  it('response contains all required top-level keys', async () => {
    requireAdminOrNotFoundMock.mockResolvedValue({ ok: true, email: 'admin@example.com' });
    mockBuildSnapshot.mockResolvedValue(EXAMPLE_SNAPSHOT);

    const res = await GET(new NextRequest('http://localhost/api/admin/home'));
    const data = await res.json();

    expect(data).toHaveProperty('generatedAt');
    expect(data).toHaveProperty('alerts');
    expect(data).toHaveProperty('pulse');
    expect(data).toHaveProperty('business');
    expect(data).toHaveProperty('trends');
    expect(data).toHaveProperty('tables');
  });

  it('spark arrays have length 30', async () => {
    requireAdminOrNotFoundMock.mockResolvedValue({ ok: true, email: 'admin@example.com' });
    mockBuildSnapshot.mockResolvedValue(EXAMPLE_SNAPSHOT);

    const res = await GET(new NextRequest('http://localhost/api/admin/home'));
    const data = await res.json();

    expect(data.pulse.users.spark).toHaveLength(30);
    expect(data.pulse.mau.spark).toHaveLength(30);
    expect(data.pulse.mrr.spark).toHaveLength(30);
    expect(data.pulse.activePaying.spark).toHaveLength(30);
  });

  it('alerts are returned in deterministic order', async () => {
    requireAdminOrNotFoundMock.mockResolvedValue({ ok: true, email: 'admin@example.com' });
    mockBuildSnapshot.mockResolvedValue({
      ...EXAMPLE_SNAPSHOT,
      alerts: [
        { kind: 'LOW_SUCCESS_RATE', message: 'msg', href: '/admin' },
        { kind: 'STRIPE_WEBHOOK_ERRORS', message: 'msg', href: '/admin' },
        { kind: 'STALE_CRITICAL_CRON', message: 'msg', href: '/admin' },
      ],
    });

    const res = await GET(new NextRequest('http://localhost/api/admin/home'));
    const data = await res.json();
    const kinds = data.alerts.map((a: { kind: string }) => a.kind);
    expect(kinds[0]).toBe('LOW_SUCCESS_RATE');
    expect(kinds[1]).toBe('STRIPE_WEBHOOK_ERRORS');
    expect(kinds[2]).toBe('STALE_CRITICAL_CRON');
  });

  it('returns 500 with error body when buildSnapshot throws', async () => {
    requireAdminOrNotFoundMock.mockResolvedValue({ ok: true, email: 'admin@example.com' });
    mockBuildSnapshot.mockRejectedValue(new Error('DB down'));

    const res = await GET(new NextRequest('http://localhost/api/admin/home'));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });
});
