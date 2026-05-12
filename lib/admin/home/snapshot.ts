import type { AdminHomeSnapshot } from './types';

export async function buildSnapshot(): Promise<AdminHomeSnapshot> {
  const [alerts, pulse, business, trends, tables] = await Promise.all([
    (async () => {
      try {
        const { computeAlerts } = await import('./alerts');
        return await computeAlerts();
      } catch (err) {
        console.error('buildSnapshot: computeAlerts failed', err);
        return [];
      }
    })(),
    (async () => {
      try {
        const { computePulseKpis } = await import('./kpis');
        return await computePulseKpis();
      } catch (err) {
        console.error('buildSnapshot: computePulseKpis failed', err);
        return emptyPulse();
      }
    })(),
    (async () => {
      try {
        const { computePlanDistribution, computeActivationFunnel, computeChurn } = await import('./business');
        const [planDistribution, activationFunnel, churn] = await Promise.all([
          computePlanDistribution(),
          computeActivationFunnel(),
          computeChurn(),
        ]);
        return { planDistribution, activationFunnel, churn };
      } catch (err) {
        console.error('buildSnapshot: business aggregators failed', err);
        return emptyBusiness();
      }
    })(),
    (async () => {
      try {
        const { computeSignupsDaily, computeJobsDaily, computeMrrMonthly } = await import('./trends');
        const [signupsDaily, jobsDaily, mrrMonthly] = await Promise.all([
          computeSignupsDaily(30),
          computeJobsDaily(30),
          computeMrrMonthly(12),
        ]);
        return { signupsDaily, jobsDaily, mrrMonthly };
      } catch (err) {
        console.error('buildSnapshot: trends aggregators failed', err);
        return emptyTrends();
      }
    })(),
    (async () => {
      try {
        const { listNewPayingUsers, listRecentCancellations, listTopUsersThisMonth, listTopProjectsThisMonth } = await import('./tables');
        const [newPaying, cancellations, topUsers, topProjects] = await Promise.all([
          listNewPayingUsers(30, 50),
          listRecentCancellations(30, 50),
          listTopUsersThisMonth(5),
          listTopProjectsThisMonth(5),
        ]);
        return { newPaying, cancellations, topUsers, topProjects };
      } catch (err) {
        console.error('buildSnapshot: tables aggregators failed', err);
        return emptyTables();
      }
    })(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    alerts,
    pulse,
    business,
    trends,
    tables,
  };
}

function emptyPulse() {
  const emptyTile = { value: 0, spark: [] };
  return {
    users: { ...emptyTile, delta7d: 0, delta30d: 0 },
    mau: { ...emptyTile, deltaPrev30d: 0, shareOfBase: null },
    mrr: { ...emptyTile, valueUsd: 0, deltaUsdThisMonth: 0, proCount: 0, teamCount: 0, proUsd: 0, teamUsd: 0 },
    activePaying: { ...emptyTile, delta30d: 0, conversionRate: null },
  };
}

function emptyBusiness() {
  return {
    planDistribution: [
      { plan: 'FREE' as const, count: 0 },
      { plan: 'PRO' as const, count: 0 },
      { plan: 'TEAM' as const, count: 0 },
    ],
    activationFunnel: {
      cohortSize: 0,
      steps: [
        { key: 'SIGNUP' as const, count: 0, stepRate: null },
        { key: 'FIRST_PROJECT' as const, count: 0, stepRate: null },
        { key: 'FIRST_JOB' as const, count: 0, stepRate: null },
        { key: 'FIRST_PAID' as const, count: 0, stepRate: null },
      ],
    },
    churn: { cancellations: 0, downgrades: 0, mrrLostUsd: 0, netMrrDeltaUsd: 0 },
  };
}

function emptyTrends() {
  return { signupsDaily: [], jobsDaily: [], mrrMonthly: [] };
}

function emptyTables() {
  return { newPaying: [], cancellations: [], topUsers: [], topProjects: [] };
}
