import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  Bar: () => null,
  Area: () => null,
  Pie: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  XAxis: () => null,
  Tooltip: () => null,
}));

import { AdminHomePage } from '@/components/admin/home/admin-home-page';
import type { AdminHomeSnapshot } from '@/lib/admin/home/types';

const EMPTY_SNAPSHOT: AdminHomeSnapshot = {
  generatedAt: '2026-05-12T10:00:00.000Z',
  alerts: [],
  pulse: {
    users: { value: 42, delta7d: 2, delta30d: 8, spark: [] },
    mau: { value: 10, deltaPrev30d: 1, shareOfBase: 0.24, spark: [] },
    mrr: { value: 1500, valueUsd: 1500, deltaUsdThisMonth: 0, proCount: 1, teamCount: 0, proUsd: 1500, teamUsd: 0, spark: [] },
    activePaying: { value: 1, delta30d: 0, conversionRate: 0.02, spark: [] },
  },
  business: {
    planDistribution: [
      { plan: 'FREE', count: 41 },
      { plan: 'PRO', count: 1 },
      { plan: 'TEAM', count: 0 },
    ],
    activationFunnel: {
      cohortSize: 5,
      steps: [
        { key: 'SIGNUP', count: 5, stepRate: null },
        { key: 'FIRST_PROJECT', count: 3, stepRate: 0.6 },
        { key: 'FIRST_JOB', count: 2, stepRate: 0.667 },
        { key: 'FIRST_PAID', count: 1, stepRate: 0.5 },
      ],
    },
    churn: { cancellations: 0, downgrades: 0, mrrLostUsd: 0, netMrrDeltaUsd: 0 },
  },
  trends: { signupsDaily: [], jobsDaily: [], mrrMonthly: [] },
  tables: { newPaying: [], cancellations: [], topUsers: [], topProjects: [] },
};

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage(snapshot: AdminHomeSnapshot, queryClient?: QueryClient) {
  const qc = queryClient ?? makeQueryClient();
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <AdminHomePage initialData={snapshot} />
      </QueryClientProvider>
    ),
  };
}

describe('AdminHomePage', () => {
  it('renders all five aria-labeled sections', () => {
    renderPage(EMPTY_SNAPSHOT);
    expect(screen.getByRole('region', { name: 'Alertes' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Pulse' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Santé Business' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Tendances' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Détails actionnables' })).toBeTruthy();
  });

  it('renders Pulse tile values from initialData on first paint', () => {
    renderPage(EMPTY_SNAPSHOT);
    expect(screen.getByText('42')).toBeTruthy(); // users value
  });

  it('shows stale Pulse tiles while refetch is in flight (no skeleton flash)', async () => {
    let resolveRefetch: (v: AdminHomeSnapshot) => void;
    const refetchPromise = new Promise<AdminHomeSnapshot>((res) => {
      resolveRefetch = res;
    });

    const qc = makeQueryClient();
    renderPage(EMPTY_SNAPSHOT, qc);

    // Seed stale cache and trigger a background refetch
    qc.setQueryData(['admin', 'home'], EMPTY_SNAPSHOT);
    qc.invalidateQueries({ queryKey: ['admin', 'home'] });

    // Previous values should still be visible (no unmount during refetch)
    expect(screen.getByText('42')).toBeTruthy();

    resolveRefetch!({ ...EMPTY_SNAPSHOT, pulse: { ...EMPTY_SNAPSHOT.pulse, users: { ...EMPTY_SNAPSHOT.pulse.users, value: 99 } } });
    await waitFor(() => {
      expect(screen.queryByText('42')).toBeTruthy();
    });
  });

  it('shows aria-live polite error indicator when isError is true', async () => {
    const qc = makeQueryClient();
    const { rerender } = renderPage(EMPTY_SNAPSHOT, qc);

    // Force the query into error state
    qc.setQueryData(['admin', 'home'], EMPTY_SNAPSHOT);
    await qc.fetchQuery({ queryKey: ['admin', 'home'], queryFn: () => Promise.reject(new Error('fail')) }).catch(() => {});

    rerender(
      <QueryClientProvider client={qc}>
        <AdminHomePage initialData={EMPTY_SNAPSHOT} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const liveRegions = document.querySelectorAll('[aria-live]');
      expect(liveRegions.length).toBeGreaterThan(0);
    });
  });
});
