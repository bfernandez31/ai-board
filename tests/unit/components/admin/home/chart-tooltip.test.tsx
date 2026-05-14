import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ChartTooltipContent } from '@/components/admin/home/chart-tooltip';

describe('ChartTooltipContent', () => {
  it('renders the title and all rows with values', () => {
    render(
      <ChartTooltipContent
        title="2026-04-22"
        rows={[
          { label: 'Completed', value: 12, color: 'hsl(var(--chart-2))' },
          { label: 'Failed', value: 0, color: 'hsl(var(--chart-3))' },
        ]}
      />
    );

    expect(screen.getByText('2026-04-22')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('uses dark-themed surface (popover background, no hard-coded white)', () => {
    render(
      <ChartTooltipContent
        title="X"
        rows={[{ label: 'A', value: 1 }]}
      />
    );

    const tip = screen.getByTestId('chart-tooltip');
    const className = tip.className;
    expect(className).toContain('bg-popover');
    expect(className).toContain('text-popover-foreground');
    expect(className).toContain('border');
    expect(className).not.toMatch(/bg-white|bg-\[#fff/i);
  });

  it('renders color swatch when a row provides a color', () => {
    const { container } = render(
      <ChartTooltipContent
        title="X"
        rows={[{ label: 'A', value: 1, color: 'red' }]}
      />
    );
    const swatch = container.querySelector('span[aria-hidden]');
    expect(swatch).toBeTruthy();
    expect((swatch as HTMLElement).style.background).toBe('red');
  });

  it('renders string values (e.g. formatted currency)', () => {
    render(
      <ChartTooltipContent
        title="2026-04"
        rows={[{ label: 'MRR', value: '$1,500' }]}
      />
    );
    expect(screen.getByText('$1,500')).toBeTruthy();
  });
});
