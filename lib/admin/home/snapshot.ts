import { computeAlerts } from './alerts';
import { computePulseKpis } from './kpis';
import {
  computePlanDistribution,
  computeActivationFunnel,
  computeChurn,
} from './business';
import {
  computeSignupsDaily,
  computeJobsDaily,
  computeMrrMonthly,
} from './trends';
import {
  listNewPayingUsers,
  listRecentCancellations,
  listTopUsersThisMonth,
  listTopProjectsThisMonth,
} from './tables';
import type { AdminHomeSnapshot } from './types';

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`buildSnapshot: ${label} failed`, err);
    return fallback;
  }
}

export async function buildSnapshot(): Promise<AdminHomeSnapshot> {
  const [alerts, pulse, business, trends, tables] = await Promise.all([
    safe('computeAlerts', computeAlerts, []),
    safe('computePulseKpis', computePulseKpis, emptyPulse()),
    (async () => {
      const empty = emptyBusiness();
      const [planDistribution, activationFunnel, churn] = await Promise.all([
        safe('computePlanDistribution', computePlanDistribution, empty.planDistribution),
        safe('computeActivationFunnel', computeActivationFunnel, empty.activationFunnel),
        safe('computeChurn', computeChurn, empty.churn),
      ]);
      return { planDistribution, activationFunnel, churn };
    })(),
    (async () => {
      const empty = emptyTrends();
      const [signupsDaily, jobsDaily, mrrMonthly] = await Promise.all([
        safe('computeSignupsDaily', () => computeSignupsDaily(30), empty.signupsDaily),
        safe('computeJobsDaily', () => computeJobsDaily(30), empty.jobsDaily),
        safe('computeMrrMonthly', () => computeMrrMonthly(12), empty.mrrMonthly),
      ]);
      return { signupsDaily, jobsDaily, mrrMonthly };
    })(),
    (async () => {
      const empty = emptyTables();
      const [newPaying, cancellations, topUsers, topProjects] = await Promise.all([
        safe('listNewPayingUsers', () => listNewPayingUsers(30, 50), empty.newPaying),
        safe('listRecentCancellations', () => listRecentCancellations(30, 50), empty.cancellations),
        safe('listTopUsersThisMonth', () => listTopUsersThisMonth(5), empty.topUsers),
        safe('listTopProjectsThisMonth', () => listTopProjectsThisMonth(5), empty.topProjects),
      ]);
      return { newPaying, cancellations, topUsers, topProjects };
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
