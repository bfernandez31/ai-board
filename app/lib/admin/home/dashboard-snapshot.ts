import { detectAlerts } from './alerts';
import { computePulse } from './pulse';
import { computeBusinessHealth } from './business-health';
import { computeTrends } from './trends';
import { computeActionable } from './actionable';
import type { AlertCard, DashboardSnapshot } from './types';

function compareAlerts(a: AlertCard, b: AlertCard): number {
  const order: Record<AlertCard['kind'], number> = {
    'job-success': 0,
    'stripe-webhook': 1,
    cron: 2,
  };
  if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
  if (a.kind === 'cron' && b.kind === 'cron') {
    const aName = a.payload.kind === 'cron' ? a.payload.workflowName : '';
    const bName = b.payload.kind === 'cron' ? b.payload.workflowName : '';
    return aName.localeCompare(bName);
  }
  return 0;
}

export async function computeDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [alerts, pulse, businessHealth, trends, actionable] = await Promise.all([
    detectAlerts(),
    computePulse(),
    computeBusinessHealth(),
    computeTrends(),
    computeActionable(),
  ]);

  const sortedAlerts = [...alerts].sort(compareAlerts);

  return {
    generatedAt: new Date().toISOString(),
    alerts: sortedAlerts,
    pulse,
    businessHealth,
    trends,
    actionable: actionable.tables,
    meta: {
      newPayingUsersTotal: actionable.totals.newPayingUsersTotal,
      recentCancellationsTotal: actionable.totals.recentCancellationsTotal,
      currencyMinorUnit: 'cents',
    },
  };
}
