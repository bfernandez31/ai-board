import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

import { PulseTile } from '@/components/admin/home/pulse-tile';

const FULL_SPARK = Array.from({ length: 30 }, (_, i) => ({
  d: `2026-04-${String(i + 1).padStart(2, '0')}`,
  v: i * 10,
}));

describe('PulseTile', () => {
  it('renders primary value', () => {
    render(
      <PulseTile
        title="Users"
        value={1342}
        deltas={[{ label: '7d', value: '+28' }]}
        spark={FULL_SPARK}
      />
    );
    expect(screen.getByText('1342')).toBeTruthy();
  });

  it('renders both deltas when provided', () => {
    render(
      <PulseTile
        title="Users"
        value={100}
        deltas={[
          { label: '7d', value: '+5' },
          { label: '30d', value: '+20' },
        ]}
        spark={FULL_SPARK}
      />
    );
    expect(screen.getByText('+5')).toBeTruthy();
    expect(screen.getByText('+20')).toBeTruthy();
  });

  it('renders em-dash for zero-prior deltas', () => {
    render(
      <PulseTile
        title="Users"
        value={0}
        deltas={[{ label: '7d', value: '—' }]}
        spark={FULL_SPARK}
      />
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders muted placeholder when spark array is empty', () => {
    const { container } = render(
      <PulseTile
        title="Users"
        value={0}
        deltas={[]}
        spark={[]}
      />
    );
    expect(container.querySelector('.text-muted-foreground')).toBeTruthy();
  });

  it('renders sparkline chart when data exists', () => {
    render(
      <PulseTile
        title="Users"
        value={100}
        deltas={[]}
        spark={FULL_SPARK}
      />
    );
    expect(screen.getByTestId('responsive-container')).toBeTruthy();
  });

  it('renders the title', () => {
    render(
      <PulseTile
        title="Active Paying"
        value={42}
        deltas={[]}
        spark={[]}
      />
    );
    expect(screen.getByText('Active Paying')).toBeTruthy();
  });
});
