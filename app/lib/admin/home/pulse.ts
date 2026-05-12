import type { DashboardSnapshot, KpiTile } from './types';

function zeroSparkline(): number[] {
  return Array.from({ length: 30 }, () => 0);
}

function zeroTile(
  id: KpiTile['id'],
  label: string,
  unit: KpiTile['unit'],
  deltas: KpiTile['deltas'],
  tooltip: string
): KpiTile {
  return {
    id,
    label,
    value: 0,
    unit,
    deltas,
    sparkline: zeroSparkline(),
    tooltip,
  };
}

export async function computePulse(): Promise<DashboardSnapshot['pulse']> {
  return {
    users: zeroTile(
      'users',
      'Utilisateurs',
      'count',
      [
        { label: 'Δ7j', value: 0, unit: 'absolute', goodDirection: 'up' },
        { label: 'Δ30j', value: 0, unit: 'absolute', goodDirection: 'up' },
      ],
      'Total inscrits sur la plateforme.'
    ),
    mau: zeroTile(
      'mau',
      'MAU',
      'count',
      [
        { label: 'vs. mois précédent', value: 0, unit: 'absolute', goodDirection: 'up' },
        { label: 'MAU / total', value: 0, unit: 'percent', goodDirection: 'up' },
      ],
      'Users with ≥1 job this month.'
    ),
    mrr: zeroTile(
      'mrr',
      'MRR estimé',
      'cents',
      [
        { label: 'Δ7j', value: 0, unit: 'absolute', goodDirection: 'up' },
        { label: 'Δ30j', value: 0, unit: 'absolute', goodDirection: 'up' },
      ],
      'MRR estimé à partir des abonnements actifs (PRO+TEAM) × prix actuels.'
    ),
    paying: zeroTile(
      'paying',
      'Active payants',
      'count',
      [
        { label: 'Δ30j', value: 0, unit: 'absolute', goodDirection: 'up' },
        { label: 'FREE→PAID', value: 0, unit: 'percent', goodDirection: 'up' },
      ],
      'Comptes avec abonnement PRO ou TEAM actif.'
    ),
  };
}
