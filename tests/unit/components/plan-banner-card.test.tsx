import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { PlanBannerCard } from '@/components/billing/plan-banner-card';

const mockUseUsage = vi.fn();
vi.mock('@/hooks/use-usage', () => ({
  useUsage: () => mockUseUsage(),
}));

describe('PlanBannerCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render skeleton when usage data is loading', () => {
    mockUseUsage.mockReturnValue({ data: undefined });
    const { container } = renderWithProviders(<PlanBannerCard />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show FREE badge and usage ratios for Free plan', () => {
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

    renderWithProviders(<PlanBannerCard />);
    expect(screen.getByText('FREE')).toBeInTheDocument();
    expect(screen.getByText(/1\/1 project/)).toBeInTheDocument();
    expect(screen.getByText(/3\/5 tickets this month/)).toBeInTheDocument();
    expect(screen.getByText(/Upgrade/)).toBeInTheDocument();
  });

  it('should show PRO badge and raw counts for Pro plan', () => {
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

    renderWithProviders(<PlanBannerCard />);
    expect(screen.getByText('PRO')).toBeInTheDocument();
    expect(screen.getByText(/4 projects/)).toBeInTheDocument();
    expect(screen.getByText(/12 tickets this month/)).toBeInTheDocument();
    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
    expect(screen.getByText(/Manage plan/)).toBeInTheDocument();
  });

  it('should show TEAM badge and raw counts for Team plan', () => {
    mockUseUsage.mockReturnValue({
      data: {
        plan: 'TEAM',
        planName: 'Team',
        projects: { current: 2, max: null },
        ticketsThisMonth: { current: 8, max: null, resetDate: '2026-04-01T00:00:00.000Z' },
        status: 'active',
        gracePeriodEndsAt: null,
      },
    });

    renderWithProviders(<PlanBannerCard />);
    expect(screen.getByText('TEAM')).toBeInTheDocument();
    expect(screen.getByText(/2 projects/)).toBeInTheDocument();
    expect(screen.getByText(/8 tickets this month/)).toBeInTheDocument();
    expect(screen.getByText(/Manage plan/)).toBeInTheDocument();
  });

  it('should apply plan-specific gradient class', () => {
    mockUseUsage.mockReturnValue({
      data: {
        plan: 'TEAM',
        planName: 'Team',
        projects: { current: 2, max: null },
        ticketsThisMonth: { current: 8, max: null, resetDate: '2026-04-01T00:00:00.000Z' },
        status: 'active',
        gracePeriodEndsAt: null,
      },
    });

    const { container } = renderWithProviders(<PlanBannerCard />);
    expect(container.querySelector('.aurora-plan-team')).toBeInTheDocument();
  });

  it('should show past-due warning when status is past_due', () => {
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

    renderWithProviders(<PlanBannerCard />);
    expect(screen.getByText(/Payment failed/)).toBeInTheDocument();
    expect(screen.getByText(/Update payment method/)).toBeInTheDocument();
  });

  it('should not show past-due warning when status is active', () => {
    mockUseUsage.mockReturnValue({
      data: {
        plan: 'PRO',
        planName: 'Pro',
        projects: { current: 2, max: null },
        ticketsThisMonth: { current: 5, max: null, resetDate: '2026-04-01T00:00:00.000Z' },
        status: 'active',
        gracePeriodEndsAt: null,
      },
    });

    renderWithProviders(<PlanBannerCard />);
    expect(screen.queryByText(/Payment failed/)).not.toBeInTheDocument();
  });

  it('should handle singular project count', () => {
    mockUseUsage.mockReturnValue({
      data: {
        plan: 'PRO',
        planName: 'Pro',
        projects: { current: 1, max: null },
        ticketsThisMonth: { current: 1, max: null, resetDate: '2026-04-01T00:00:00.000Z' },
        status: 'active',
        gracePeriodEndsAt: null,
      },
    });

    renderWithProviders(<PlanBannerCard />);
    expect(screen.getByText(/1 project \u00b7 1 ticket this month/)).toBeInTheDocument();
  });
});
