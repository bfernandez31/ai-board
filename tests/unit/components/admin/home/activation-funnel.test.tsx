import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ActivationFunnelChart } from '@/components/admin/home/activation-funnel';
import type { ActivationFunnel } from '@/lib/admin/home/types';

const FULL_FUNNEL: ActivationFunnel = {
  cohortSize: 100,
  steps: [
    { key: 'SIGNUP', count: 100, stepRate: null },
    { key: 'FIRST_PROJECT', count: 74, stepRate: 0.74 },
    { key: 'FIRST_JOB', count: 58, stepRate: 0.784 },
    { key: 'FIRST_PAID', count: 11, stepRate: 0.19 },
  ],
};

const EMPTY_FUNNEL: ActivationFunnel = {
  cohortSize: 0,
  steps: [
    { key: 'SIGNUP', count: 0, stepRate: null },
    { key: 'FIRST_PROJECT', count: 0, stepRate: null },
    { key: 'FIRST_JOB', count: 0, stepRate: null },
    { key: 'FIRST_PAID', count: 0, stepRate: null },
  ],
};

describe('ActivationFunnelChart', () => {
  it('renders 4 steps in order', () => {
    render(<ActivationFunnelChart data={FULL_FUNNEL} />);
    const steps = screen.getAllByRole('listitem');
    expect(steps.length).toBe(4);
  });

  it('renders stepRate as em-dash when null', () => {
    render(<ActivationFunnelChart data={FULL_FUNNEL} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1); // SIGNUP step has null rate
  });

  it('does not render NaN% for null stepRate', () => {
    render(<ActivationFunnelChart data={FULL_FUNNEL} />);
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it('renders empty-state placeholder when cohortSize is 0', () => {
    const { container } = render(<ActivationFunnelChart data={EMPTY_FUNNEL} />);
    expect(container.querySelector('.text-muted-foreground')).toBeTruthy();
  });
});
