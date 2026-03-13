import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { OverviewCards } from '@/components/analytics/overview-cards';

describe('OverviewCards', () => {
  it('renders shipped and closed summary cards with the active period label', () => {
    renderWithProviders(
      <OverviewCards
        metrics={{
          totalCost: 123.45,
          costTrend: 12.3,
          successRate: 98.7,
          avgDuration: 120000,
          ticketsShipped: 4,
          ticketsClosed: 2,
          ticketPeriodLabel: 'Last 7 days',
        }}
      />
    );

    expect(screen.getByText('Tickets Shipped')).toBeInTheDocument();
    expect(screen.getByText('Tickets Closed')).toBeInTheDocument();
    expect(screen.getAllByText('Last 7 days')).toHaveLength(2);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
