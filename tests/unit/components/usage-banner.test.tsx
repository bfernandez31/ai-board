import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { UsageBanner } from '@/components/billing/usage-banner';

// Mock useUsage hook
const mockUseUsage = vi.fn();
vi.mock('@/hooks/use-usage', () => ({
  useUsage: () => mockUseUsage(),
}));

describe('UsageBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when usage data is not available', () => {
    mockUseUsage.mockReturnValue({ data: undefined });
    const { container } = renderWithProviders(<UsageBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('should show quota numbers for Free plan user', () => {
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
    expect(screen.getByText(/1\/1 projects/)).toBeInTheDocument();
    expect(screen.getByText(/3\/5 tickets this month/)).toBeInTheDocument();
    expect(screen.getByText(/Free Plan/)).toBeInTheDocument();
  });

  it('should show only plan name for Pro plan user (no quotas)', () => {
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
    expect(screen.getByText('Pro Plan')).toBeInTheDocument();
    expect(screen.queryByText(/\d+\/\d+ projects/)).not.toBeInTheDocument();
  });

  it('should show only plan name for Team plan user', () => {
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

    renderWithProviders(<UsageBanner />);
    expect(screen.getByText('Team Plan')).toBeInTheDocument();
  });

  it('should show grace period warning when status is past_due', () => {
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
    expect(screen.getByText(/Update payment method/)).toBeInTheDocument();
  });

  it('should not show grace period warning when status is active', () => {
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

    renderWithProviders(<UsageBanner />);
    expect(screen.queryByText(/Payment failed/)).not.toBeInTheDocument();
  });
});
