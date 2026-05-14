import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    job: { count: vi.fn() },
    webhookOutcome: { count: vi.fn() },
    cronRun: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/db/client', () => ({ prisma: mockPrisma }));

import { computeAlerts } from '@/lib/admin/home/alerts';

describe('computeAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LOW_SUCCESS_RATE alert', () => {
    it('does not fire when denominator < 20', async () => {
      mockPrisma.job.count
        .mockResolvedValueOnce(10) // denominator
        .mockResolvedValueOnce(8); // numerator
      mockPrisma.webhookOutcome.count.mockResolvedValue(0);
      mockPrisma.cronRun.findMany.mockResolvedValue([]);

      const alerts = await computeAlerts();
      expect(alerts.find((a) => a.kind === 'LOW_SUCCESS_RATE')).toBeUndefined();
    });

    it('does not fire when ratio >= 0.9 with denominator >= 20', async () => {
      mockPrisma.job.count
        .mockResolvedValueOnce(20) // denominator
        .mockResolvedValueOnce(18); // numerator (90%)
      mockPrisma.webhookOutcome.count.mockResolvedValue(0);
      mockPrisma.cronRun.findMany.mockResolvedValue([]);

      const alerts = await computeAlerts();
      expect(alerts.find((a) => a.kind === 'LOW_SUCCESS_RATE')).toBeUndefined();
    });

    it('fires when denominator >= 20 and ratio < 0.9', async () => {
      mockPrisma.job.count
        .mockResolvedValueOnce(36) // denominator
        .mockResolvedValueOnce(28); // numerator (77.8%)
      mockPrisma.webhookOutcome.count.mockResolvedValue(0);
      mockPrisma.cronRun.findMany.mockResolvedValue([]);

      const alerts = await computeAlerts();
      const alert = alerts.find((a) => a.kind === 'LOW_SUCCESS_RATE');
      expect(alert).toBeDefined();
      expect(alert?.href).toBeTruthy();
    });

    it('fires exactly at threshold (denominator=20, 17/20 = 85% < 90%)', async () => {
      mockPrisma.job.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(17);
      mockPrisma.webhookOutcome.count.mockResolvedValue(0);
      mockPrisma.cronRun.findMany.mockResolvedValue([]);

      const alerts = await computeAlerts();
      expect(alerts.find((a) => a.kind === 'LOW_SUCCESS_RATE')).toBeDefined();
    });
  });

  describe('STRIPE_WEBHOOK_ERRORS alert', () => {
    it('fires when any FAILURE exists in 24h', async () => {
      mockPrisma.job.count
        .mockResolvedValueOnce(5) // denominator < 20
        .mockResolvedValueOnce(5);
      mockPrisma.webhookOutcome.count.mockResolvedValue(1);
      mockPrisma.cronRun.findMany.mockResolvedValue([]);

      const alerts = await computeAlerts();
      expect(alerts.find((a) => a.kind === 'STRIPE_WEBHOOK_ERRORS')).toBeDefined();
    });

    it('does not fire when count is 0', async () => {
      mockPrisma.job.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);
      mockPrisma.webhookOutcome.count.mockResolvedValue(0);
      mockPrisma.cronRun.findMany.mockResolvedValue([]);

      const alerts = await computeAlerts();
      expect(alerts.find((a) => a.kind === 'STRIPE_WEBHOOK_ERRORS')).toBeUndefined();
    });
  });

  describe('STALE_CRITICAL_CRON alert', () => {
    it('fires when a cron has no row (never ran)', async () => {
      mockPrisma.job.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);
      mockPrisma.webhookOutcome.count.mockResolvedValue(0);
      mockPrisma.cronRun.findMany.mockResolvedValue([]); // no rows

      const alerts = await computeAlerts();
      const staleAlerts = alerts.filter((a) => a.kind === 'STALE_CRITICAL_CRON');
      expect(staleAlerts.length).toBeGreaterThan(0);
    });

    it('fires when lastSuccessAt is older than threshold (36h)', async () => {
      const staleDate = new Date(Date.now() - 37 * 60 * 60 * 1000);
      mockPrisma.job.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);
      mockPrisma.webhookOutcome.count.mockResolvedValue(0);
      mockPrisma.cronRun.findMany.mockResolvedValue([
        { cron: 'NIGHTLY_LOG_PRUNE', lastSuccessAt: staleDate },
        { cron: 'NIGHTLY_HEALTH_SCANS', lastSuccessAt: new Date() },
        { cron: 'BILLING_RECONCILE', lastSuccessAt: new Date() },
      ]);

      const alerts = await computeAlerts();
      const staleAlerts = alerts.filter((a) => a.kind === 'STALE_CRITICAL_CRON');
      expect(staleAlerts.length).toBe(1);
    });

    it('does not fire when all crons ran recently', async () => {
      const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000);
      mockPrisma.job.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);
      mockPrisma.webhookOutcome.count.mockResolvedValue(0);
      mockPrisma.cronRun.findMany.mockResolvedValue([
        { cron: 'NIGHTLY_LOG_PRUNE', lastSuccessAt: recentDate },
        { cron: 'NIGHTLY_HEALTH_SCANS', lastSuccessAt: recentDate },
        { cron: 'BILLING_RECONCILE', lastSuccessAt: recentDate },
      ]);

      const alerts = await computeAlerts();
      expect(alerts.find((a) => a.kind === 'STALE_CRITICAL_CRON')).toBeUndefined();
    });
  });

  describe('deterministic ordering', () => {
    it('returns alerts in order: LOW_SUCCESS_RATE → STRIPE_WEBHOOK_ERRORS → STALE_CRITICAL_CRON', async () => {
      const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
      mockPrisma.job.count
        .mockResolvedValueOnce(36)
        .mockResolvedValueOnce(28);
      mockPrisma.webhookOutcome.count.mockResolvedValue(2);
      mockPrisma.cronRun.findMany.mockResolvedValue([
        { cron: 'NIGHTLY_LOG_PRUNE', lastSuccessAt: staleDate },
        { cron: 'NIGHTLY_HEALTH_SCANS', lastSuccessAt: staleDate },
        { cron: 'BILLING_RECONCILE', lastSuccessAt: staleDate },
      ]);

      const alerts = await computeAlerts();
      const kinds = alerts.map((a) => a.kind);
      const lowIdx = kinds.indexOf('LOW_SUCCESS_RATE');
      const stripeIdx = kinds.indexOf('STRIPE_WEBHOOK_ERRORS');
      const cronIdx = kinds.indexOf('STALE_CRITICAL_CRON');

      expect(lowIdx).toBeGreaterThanOrEqual(0);
      expect(stripeIdx).toBeGreaterThan(lowIdx);
      expect(cronIdx).toBeGreaterThan(stripeIdx);
    });
  });
});
