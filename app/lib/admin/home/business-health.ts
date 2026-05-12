import type { DashboardSnapshot, FunnelStep } from './types';

function zeroFunnel(): FunnelStep[] {
  return [
    { id: 'signups', label: 'Inscriptions', count: 0, conversionFromPrevious: null },
    { id: 'first_project', label: '1er projet', count: 0, conversionFromPrevious: null },
    { id: 'first_job', label: '1er job', count: 0, conversionFromPrevious: null },
    { id: 'paid', label: 'Activation payante', count: 0, conversionFromPrevious: null },
  ];
}

export async function computeBusinessHealth(): Promise<DashboardSnapshot['businessHealth']> {
  return {
    planDistribution: { free: 0, pro: 0, team: 0 },
    activationFunnel: zeroFunnel(),
    churn: {
      cancellationsCount: 0,
      downgradesCount: 0,
      mrrLostCents: 0,
      netMrrDeltaCents: 0,
    },
  };
}
