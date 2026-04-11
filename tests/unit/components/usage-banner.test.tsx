import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { UsageBanner } from '@/components/billing/usage-banner';

const mockUseUsage = vi.fn();

vi.mock('@/hooks/use-usage', () => ({
  useUsage: () => mockUseUsage(),
}));

describe('UsageBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a fixed-height loading skeleton while usage data is unavailable', () => {
    mockUseUsage.mockReturnValue({ data: undefined });

    renderWithProviders(<UsageBanner />);

    const skeleton = screen.getByTestId('usage-banner-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('min-h-24');
    expect(skeleton).toHaveClass('animate-pulse');
  });

  it('shows ratios and an upgrade action for Free plan users', () => {
    mockUseUsage.mockReturnValue({
      data: {
        plan: 'FREE',
        planName: 'Free',
        projects: { current: 1, max: 1 },
        ticketsThisMonth: { current: 3, max: 5, resetDate: '2026-04-01T00:00:00.000Z' },
        status: 'none',
        gracePeriodEndsAt: null,
      },
    });

    renderWithProviders(<UsageBanner />);

    expect(screen.getByText('FREE')).toBeInTheDocument();
    expect(screen.getByText('1/1 project · 3/5 tickets this month')).toBeInTheDocument();

    const cta = screen.getByRole('link', { name: /upgrade/i });
    expect(cta).toHaveAttribute('href', '/settings/billing');
  });

  it('shows raw counts and a manage plan action for Pro users', () => {
    mockUseUsage.mockReturnValue({
      data: {
        plan: 'PRO',
        planName: 'Pro',
        projects: { current: 4, max: null },
        ticketsThisMonth: { current: 12, max: null, resetDate: '2026-04-01T00:00:00.000Z' },
        status: 'active',
        gracePeriodEndsAt: null,
      },
    });

    renderWithProviders(<UsageBanner />);

    expect(screen.getByText('PRO')).toBeInTheDocument();
    expect(screen.getByText('4 projects · 12 tickets this month')).toBeInTheDocument();
    expect(screen.queryByText('4/4 project · 12/12 tickets this month')).not.toBeInTheDocument();

    const cta = screen.getByRole('link', { name: /manage plan/i });
    expect(cta).toHaveAttribute('href', '/settings/billing');
  });

  it('shows team styling and counts for Team users', () => {
    mockUseUsage.mockReturnValue({
      data: {
        plan: 'TEAM',
        planName: 'Team',
        projects: { current: 2, max: null },
        ticketsThisMonth: { current: 18, max: null, resetDate: '2026-04-01T00:00:00.000Z' },
        status: 'active',
        gracePeriodEndsAt: null,
      },
    });

    renderWithProviders(<UsageBanner />);

    expect(screen.getByText('TEAM')).toBeInTheDocument();
    expect(screen.getByText('2 projects · 18 tickets this month')).toBeInTheDocument();
    expect(screen.getByTestId('usage-banner-card')).toHaveClass('from-indigo-500/15');
    expect(screen.getByTestId('usage-banner-badge')).toHaveClass('bg-violet-500/15');
  });

  it('shows the past-due warning when payment is overdue', () => {
    mockUseUsage.mockReturnValue({
      data: {
        plan: 'PRO',
        planName: 'Pro',
        projects: { current: 2, max: null },
        ticketsThisMonth: { current: 5, max: null, resetDate: '2026-04-01T00:00:00.000Z' },
        status: 'past_due',
        gracePeriodEndsAt: '2026-03-20T00:00:00.000Z',
      },
    });

    renderWithProviders(<UsageBanner />);

    expect(screen.getByText(/Payment failed/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /update payment method/i })).toHaveAttribute('href', '/settings/billing');
  });
});
