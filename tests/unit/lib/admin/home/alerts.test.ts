import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    job: { count: vi.fn() },
    subscription: { count: vi.fn() },
    stripeEvent: { count: vi.fn() },
    cronRunLog: { findFirst: vi.fn() },
  },
}));

import { prisma } from '@/lib/db/client';
import { detectAlerts, CRITICAL_CRONS } from '@/app/lib/admin/home/alerts';

type MockedPrisma = {
  job: { count: ReturnType<typeof vi.fn> };
  subscription: { count: ReturnType<typeof vi.fn> };
  stripeEvent: { count: ReturnType<typeof vi.fn> };
  cronRunLog: { findFirst: ReturnType<typeof vi.fn> };
};

const mockedPrisma = prisma as unknown as MockedPrisma;

const NOW = new Date('2026-05-12T10:00:00.000Z');
const SIX_HOURS_AGO = new Date(NOW.getTime() - 6 * 3_600_000);
const FORTY_EIGHT_HOURS_AGO = new Date(NOW.getTime() - 48 * 3_600_000);

beforeEach(() => {
  vi.resetAllMocks();
});

function setupHealthy() {
  // job-success: high success rate
  mockedPrisma.job.count
    .mockResolvedValueOnce(95) // completed
    .mockResolvedValueOnce(2) // failed
    .mockResolvedValueOnce(1); // cancelled
  // stripe: no transitions
  mockedPrisma.subscription.count.mockResolvedValue(0);
  mockedPrisma.stripeEvent.count.mockResolvedValue(0);
  // cron: recent rows for all CRITICAL_CRONS
  mockedPrisma.cronRunLog.findFirst.mockResolvedValue({ ranAt: SIX_HOURS_AGO });
}

describe('detectAlerts', () => {
  it('returns empty array when healthy (FR-004, SC-003)', async () => {
    setupHealthy();
    const alerts = await detectAlerts(NOW);
    expect(alerts).toEqual([]);
  });

  it('triggers job-success alert when rate < 0.90', async () => {
    mockedPrisma.job.count
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(15)
      .mockResolvedValueOnce(5);
    mockedPrisma.subscription.count.mockResolvedValue(0);
    mockedPrisma.stripeEvent.count.mockResolvedValue(0);
    mockedPrisma.cronRunLog.findFirst.mockResolvedValue({ ranAt: SIX_HOURS_AGO });

    const alerts = await detectAlerts(NOW);
    const jobSuccess = alerts.find((a) => a.kind === 'job-success');
    expect(jobSuccess).toBeDefined();
    if (jobSuccess && jobSuccess.payload.kind === 'job-success') {
      expect(jobSuccess.payload.successRatePct).toBeCloseTo(80 / 100, 5);
      expect(jobSuccess.payload.failedCount).toBe(20);
      expect(jobSuccess.payload.windowDays).toBe(7);
    }
  });

  it('does not trigger job-success when total is 0', async () => {
    mockedPrisma.job.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockedPrisma.subscription.count.mockResolvedValue(0);
    mockedPrisma.stripeEvent.count.mockResolvedValue(0);
    mockedPrisma.cronRunLog.findFirst.mockResolvedValue({ ranAt: SIX_HOURS_AGO });

    const alerts = await detectAlerts(NOW);
    expect(alerts.find((a) => a.kind === 'job-success')).toBeUndefined();
  });

  it('triggers stripe-webhook alert when transitions exist but no matching events', async () => {
    mockedPrisma.job.count
      .mockResolvedValueOnce(95)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    mockedPrisma.subscription.count.mockResolvedValue(3); // transitions
    mockedPrisma.stripeEvent.count.mockResolvedValue(0); // no events
    mockedPrisma.cronRunLog.findFirst.mockResolvedValue({ ranAt: SIX_HOURS_AGO });

    const alerts = await detectAlerts(NOW);
    const stripe = alerts.find((a) => a.kind === 'stripe-webhook');
    expect(stripe).toBeDefined();
    if (stripe && stripe.payload.kind === 'stripe-webhook') {
      expect(stripe.payload.transitionsInWindow).toBe(3);
    }
  });

  it('does not trigger stripe-webhook when matching events exist', async () => {
    mockedPrisma.job.count
      .mockResolvedValueOnce(95)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    mockedPrisma.subscription.count.mockResolvedValue(3);
    mockedPrisma.stripeEvent.count.mockResolvedValue(5);
    mockedPrisma.cronRunLog.findFirst.mockResolvedValue({ ranAt: SIX_HOURS_AGO });

    const alerts = await detectAlerts(NOW);
    expect(alerts.find((a) => a.kind === 'stripe-webhook')).toBeUndefined();
  });

  it('triggers cron alert per stale CRITICAL_CRON', async () => {
    mockedPrisma.job.count
      .mockResolvedValueOnce(95)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    mockedPrisma.subscription.count.mockResolvedValue(0);
    mockedPrisma.stripeEvent.count.mockResolvedValue(0);
    mockedPrisma.cronRunLog.findFirst
      .mockResolvedValueOnce({ ranAt: FORTY_EIGHT_HOURS_AGO }) // nightly-health stale
      .mockResolvedValueOnce({ ranAt: SIX_HOURS_AGO }); // nightly-log-prune fresh

    const alerts = await detectAlerts(NOW);
    const cronAlerts = alerts.filter((a) => a.kind === 'cron');
    expect(cronAlerts).toHaveLength(1);
    if (cronAlerts[0] && cronAlerts[0].payload.kind === 'cron') {
      expect(cronAlerts[0].payload.workflowName).toBe('nightly-health');
    }
  });

  it('triggers cron alert when no row exists (null)', async () => {
    mockedPrisma.job.count
      .mockResolvedValueOnce(95)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    mockedPrisma.subscription.count.mockResolvedValue(0);
    mockedPrisma.stripeEvent.count.mockResolvedValue(0);
    mockedPrisma.cronRunLog.findFirst.mockResolvedValue(null);

    const alerts = await detectAlerts(NOW);
    const cronAlerts = alerts.filter((a) => a.kind === 'cron');
    expect(cronAlerts).toHaveLength(CRITICAL_CRONS.length);
    for (const a of cronAlerts) {
      if (a.payload.kind === 'cron') {
        expect(a.payload.lastSuccessAt).toBeNull();
      }
    }
  });

  it('orders alerts: job-success → stripe-webhook → cron sorted asc', async () => {
    mockedPrisma.job.count
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(10);
    mockedPrisma.subscription.count.mockResolvedValue(3);
    mockedPrisma.stripeEvent.count.mockResolvedValue(0);
    mockedPrisma.cronRunLog.findFirst.mockResolvedValue(null);

    const alerts = await detectAlerts(NOW);
    expect(alerts[0]?.kind).toBe('job-success');
    expect(alerts[1]?.kind).toBe('stripe-webhook');
    expect(alerts[2]?.kind).toBe('cron');
    const cronNames = alerts
      .filter((a) => a.kind === 'cron')
      .map((a) => (a.payload.kind === 'cron' ? a.payload.workflowName : ''));
    expect(cronNames).toEqual([...cronNames].sort());
  });
});
