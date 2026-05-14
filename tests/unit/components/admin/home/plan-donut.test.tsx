import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data, children }: { data: unknown[]; children?: React.ReactNode }) => (
    <div data-testid="pie" data-count={data.length}>{children}</div>
  ),
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import { PlanDonut } from '@/components/admin/home/plan-donut';

const THREE_SEGMENTS = [
  { plan: 'FREE' as const, count: 100 },
  { plan: 'PRO' as const, count: 10 },
  { plan: 'TEAM' as const, count: 5 },
];

describe('PlanDonut', () => {
  it('renders three segments (FREE, PRO, TEAM)', () => {
    render(<PlanDonut data={THREE_SEGMENTS} />);
    const pie = document.querySelector('[data-testid="pie"]');
    expect(pie?.getAttribute('data-count')).toBe('3');
  });

  it('shows count for each segment in the legend/label area', () => {
    render(<PlanDonut data={THREE_SEGMENTS} />);
    expect(screen.getByText('100')).toBeTruthy(); // FREE count
    expect(screen.getByText('10')).toBeTruthy();  // PRO count
    expect(screen.getByText('5')).toBeTruthy();   // TEAM count
  });

  it('renders zero-count plans in legend without errors', () => {
    const dataWithZero = [
      { plan: 'FREE' as const, count: 50 },
      { plan: 'PRO' as const, count: 0 },
      { plan: 'TEAM' as const, count: 0 },
    ];
    render(<PlanDonut data={dataWithZero} />);
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
  });
});
