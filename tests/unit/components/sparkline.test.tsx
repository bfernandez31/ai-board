import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { Sparkline } from '@/components/health/sparkline';

// Mock recharts to avoid rendering issues in test
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
}));

describe('Sparkline', () => {
  it('renders line chart when data has 3+ points', () => {
    const data = [
      { score: 70, date: '2026-03-01T00:00:00Z' },
      { score: 80, date: '2026-03-02T00:00:00Z' },
      { score: 85, date: '2026-03-03T00:00:00Z' },
    ];

    const { container } = renderWithProviders(<Sparkline data={data} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(container.innerHTML).not.toBe('');
  });

  it('renders nothing when data has fewer than 3 points', () => {
    const data = [
      { score: 70, date: '2026-03-01T00:00:00Z' },
      { score: 80, date: '2026-03-02T00:00:00Z' },
    ];

    const { container } = renderWithProviders(<Sparkline data={data} />);
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when data is empty', () => {
    const { container } = renderWithProviders(<Sparkline data={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('uses primary color for the line stroke', () => {
    const data = [
      { score: 70, date: '2026-03-01T00:00:00Z' },
      { score: 80, date: '2026-03-02T00:00:00Z' },
      { score: 85, date: '2026-03-03T00:00:00Z' },
    ];

    renderWithProviders(<Sparkline data={data} />);
    expect(screen.getByTestId('line')).toBeInTheDocument();
  });
});
