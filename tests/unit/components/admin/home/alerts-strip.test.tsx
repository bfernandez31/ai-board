import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { AlertsStrip } from '@/components/admin/home/alerts-strip';
import type { AlertCard } from '@/app/lib/admin/home/types';

const jobSuccessAlert: AlertCard = {
  kind: 'job-success',
  id: 'job-success',
  payload: { kind: 'job-success', successRatePct: 0.84, failedCount: 18, windowDays: 7 },
  actionLabel: 'Voir les jobs failed',
  actionHref: '/projects?jobStatus=FAILED&since=7d',
};

const stripeAlert: AlertCard = {
  kind: 'stripe-webhook',
  id: 'stripe-webhook',
  payload: { kind: 'stripe-webhook', transitionsInWindow: 2, windowHours: 24 },
  actionLabel: 'Vérifier les webhooks Stripe',
  actionHref: '/admin/insights',
};

const cronAlert: AlertCard = {
  kind: 'cron',
  id: 'cron:nightly-health',
  payload: {
    kind: 'cron',
    workflowName: 'nightly-health',
    lastSuccessAt: '2026-05-10T00:00:00Z',
    hoursSinceLastSuccess: 48,
  },
  actionLabel: 'Voir nightly-health',
  actionHref: 'https://github.com/owner/repo/actions/workflows/nightly-health.yml',
};

describe('<AlertsStrip>', () => {
  it('returns null (no DOM) when alerts array is empty (FR-004, SC-003)', () => {
    const { container } = renderWithProviders(<AlertsStrip alerts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders alerts in fixed order: job-success → stripe-webhook → cron', () => {
    renderWithProviders(
      <AlertsStrip alerts={[jobSuccessAlert, stripeAlert, cronAlert]} />
    );

    const rows = screen.getAllByText(/Taux de succès|transition|Cron critique/);
    expect(rows[0]?.textContent).toMatch(/Taux de succès/);
    expect(rows[1]?.textContent).toMatch(/transition/);
    expect(rows[2]?.textContent).toMatch(/Cron critique/);
  });

  it('renders external cron link with target=_blank', () => {
    renderWithProviders(<AlertsStrip alerts={[cronAlert]} />);
    const link = screen.getByRole('link', { name: /Voir nightly-health/ });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });

  it('uses theme tokens, no hex literals (FR-029)', () => {
    const { container } = renderWithProviders(
      <AlertsStrip alerts={[jobSuccessAlert]} />
    );
    const html = container.innerHTML;
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
