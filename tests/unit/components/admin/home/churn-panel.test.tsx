import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ChurnPanel } from '@/components/admin/home/churn-panel';
import type { Churn } from '@/lib/admin/home/types';

const CHURN_DATA: Churn = {
  cancellations: 3,
  downgrades: 1,
  mrrLostUsd: 6000,
  netMrrDeltaUsd: -1500,
};

describe('ChurnPanel', () => {
  it('renders cancellation count', () => {
    render(<ChurnPanel data={CHURN_DATA} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders downgrade count', () => {
    render(<ChurnPanel data={CHURN_DATA} />);
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders MRR lost in USD format', () => {
    render(<ChurnPanel data={CHURN_DATA} />);
    // formatUsdCents(6000) = "$60.00"
    expect(screen.getByText('$60.00')).toBeTruthy();
  });

  it('renders net MRR delta with negative sign', () => {
    render(<ChurnPanel data={CHURN_DATA} />);
    // netMrrDeltaUsd = -1500 → "-$15.00"
    expect(screen.getByText('-$15.00')).toBeTruthy();
  });

  it('renders zero values without errors', () => {
    const zero: Churn = { cancellations: 0, downgrades: 0, mrrLostUsd: 0, netMrrDeltaUsd: 0 };
    render(<ChurnPanel data={zero} />);
    // Multiple 0 or $0.00 values should be rendered
    const zeroTexts = screen.getAllByText('0');
    expect(zeroTexts.length).toBeGreaterThanOrEqual(2);
  });
});
