/**
 * Integration: SC-002 — for any non-admin viewer (authenticated or anonymous),
 * the rendered global-header HTML contains ZERO admin-related markup. We
 * server-render the Header (the only consumer of the `isAdmin` prop the root
 * layout produces) with `isAdmin={false}` and assert there is no `/admin`
 * href, no `Admin` link text, and no `data-admin` attribute in the output.
 *
 * Mirrors the AIB-791 byte-parity guarantee with the new AIB-796 prop wiring:
 * the only source of admin markup is `isAdmin === true`, so a `false` value
 * MUST short-circuit it everywhere downstream (UserMenu + MobileMenu).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

const sessionMock = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => sessionMock(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/app/components/notifications/notification-bell', () => ({
  NotificationBell: () => null,
}));

// next/link is a no-op pass-through anchor for rendering purposes.
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

beforeEach(() => {
  // No-op fetch so the project-info effect (which only runs in the DOM, not
  // during renderToStaticMarkup) is fully decoupled.
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({}),
  }) as unknown as typeof fetch;
});

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { AdminHomePage } from '@/components/admin/home/admin-home-page';
import type { AdminHomeSnapshot } from '@/lib/admin/home/types';

function assertNoAdminMarkup(html: string) {
  expect(html).not.toMatch(/href="\/admin/);
  expect(html).not.toMatch(/\/admin(?:["/]|$)/);
  expect(html).not.toMatch(/>Admin</);
  expect(html).not.toMatch(/data-admin/);
}

const EMPTY_SNAPSHOT: AdminHomeSnapshot = {
  generatedAt: new Date().toISOString(),
  alerts: [],
  pulse: {
    users: { value: 0, delta7d: 0, delta30d: 0, spark: [] },
    mau: { value: 0, deltaPrev30d: 0, shareOfBase: null, spark: [] },
    mrr: { value: 0, valueUsd: 0, deltaUsdThisMonth: 0, proCount: 0, teamCount: 0, proUsd: 0, teamUsd: 0, spark: [] },
    activePaying: { value: 0, delta30d: 0, conversionRate: null, spark: [] },
  },
  business: {
    planDistribution: [
      { plan: 'FREE', count: 0 },
      { plan: 'PRO', count: 0 },
      { plan: 'TEAM', count: 0 },
    ],
    activationFunnel: {
      cohortSize: 0,
      steps: [
        { key: 'SIGNUP', count: 0, stepRate: null },
        { key: 'FIRST_PROJECT', count: 0, stepRate: null },
        { key: 'FIRST_JOB', count: 0, stepRate: null },
        { key: 'FIRST_PAID', count: 0, stepRate: null },
      ],
    },
    churn: { cancellations: 0, downgrades: 0, mrrLostUsd: 0, netMrrDeltaUsd: 0 },
  },
  trends: { signupsDaily: [], jobsDaily: [], mrrMonthly: [] },
  tables: { newPaying: [], cancellations: [], topUsers: [], topProjects: [] },
};

describe('admin-shell isolation — no admin markup for non-admins (SC-002)', () => {
  it('does not render any admin markup for an authenticated non-admin', () => {
    sessionMock.mockReturnValue({
      data: { user: { email: 'user@e2e.local', name: 'A' } },
      status: 'authenticated',
    });

    const html = renderToStaticMarkup(React.createElement(Header, { isAdmin: false }));
    assertNoAdminMarkup(html);
  });

  it('does not render any admin markup for an unauthenticated viewer', () => {
    sessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });

    const html = renderToStaticMarkup(React.createElement(Header, { isAdmin: false }));
    assertNoAdminMarkup(html);
  });
});

describe('AdminHomePage dashboard landmarks (AIB-800)', () => {
  it('renders all five section landmarks for an admin', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(AdminHomePage, { initialData: EMPTY_SNAPSHOT })
      )
    );

    expect(screen.getByRole('region', { name: 'Alertes' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Pulse' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Santé Business' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Tendances' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Détails actionnables' })).toBeTruthy();
  });
});
