import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { AdminHomeDashboard } from '@/components/admin/home/admin-home-dashboard';
import type { DashboardSnapshot, KpiTile } from '@/app/lib/admin/home/types';

function makeTile(id: KpiTile['id']): KpiTile {
  return {
    id,
    label: id,
    value: 1,
    unit: 'count',
    deltas: [
      { label: 'Δ7j', value: 0, unit: 'absolute', goodDirection: 'up' },
      { label: 'Δ30j', value: 0, unit: 'absolute', goodDirection: 'up' },
    ],
    sparkline: Array.from({ length: 30 }, () => 0),
    tooltip: 'tooltip',
  };
}

function makeSnapshot(): DashboardSnapshot {
  return {
    generatedAt: '2026-05-12T10:00:00.000Z',
    alerts: [],
    pulse: {
      users: makeTile('users'),
      mau: makeTile('mau'),
      mrr: makeTile('mrr'),
      paying: makeTile('paying'),
    },
    businessHealth: {
      planDistribution: { free: 0, pro: 0, team: 0 },
      activationFunnel: [
        { id: 'signups', label: 'Inscriptions', count: 0, conversionFromPrevious: null },
        { id: 'first_project', label: '1er projet', count: 0, conversionFromPrevious: null },
        { id: 'first_job', label: '1er job', count: 0, conversionFromPrevious: null },
        { id: 'paid', label: 'Activation payante', count: 0, conversionFromPrevious: null },
      ],
      churn: { cancellationsCount: 0, downgradesCount: 0, mrrLostCents: 0, netMrrDeltaCents: 0 },
    },
    trends: {
      signupsPerDay: Array.from({ length: 30 }, () => ({ date: '2026-05-01', value: 0 })),
      jobsPerDay: Array.from({ length: 30 }, () => ({
        date: '2026-05-01',
        completed: 0,
        failed: 0,
      })),
      mrrPerMonth: Array.from({ length: 12 }, () => ({ month: '2026-05', mrrCents: 0 })),
    },
    actionable: {
      newPayingUsers: [],
      recentCancellations: [],
      topActiveUsers: [],
      topProjects: [],
    },
    meta: {
      newPayingUsersTotal: 0,
      recentCancellationsTotal: 0,
      currencyMinorUnit: 'cents',
    },
  };
}

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = originalFetch;
});

describe('<AdminHomeDashboard>', () => {
  it('renders the 4 KPI tiles from initialData', () => {
    renderWithProviders(<AdminHomeDashboard initialData={makeSnapshot()} />);

    expect(screen.getAllByRole('button', { name: /definition/i })).toHaveLength(4);
  });

  it('renders no alerts strip when alerts is empty', () => {
    renderWithProviders(<AdminHomeDashboard initialData={makeSnapshot()} />);
    expect(screen.queryByText(/Alertes plateforme/i)).toBeNull();
  });

  it('renders page-level error banner on query error and retry button', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const snapshot = makeSnapshot();
    const { queryClient } = renderWithProviders(
      <AdminHomeDashboard initialData={snapshot} />
    );

    // Trigger a refetch so the failing fetch flips the query into error state.
    await queryClient.refetchQueries({ queryKey: ['admin', 'home', 'snapshot'] });

    await waitFor(() => {
      const alert = screen.queryByRole('alert');
      expect(alert).not.toBeNull();
    });
    expect(screen.getByRole('button', { name: /Réessayer/i })).toBeTruthy();
  });
});
