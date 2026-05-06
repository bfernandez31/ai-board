import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ConfusionMatrixTable } from '@/components/calibration/confusion-matrix-table';
import type { ConfusionMatrix } from '@/lib/calibration/types';

const baseMatrix: ConfusionMatrix = {
  truePositive: 8,
  trueNegative: 6,
  falsePositive: 3,
  falseNegative: 3,
  precisionLowRisk: 8 / 11,
  recallLowRisk: 8 / 11,
  total: 20,
};

describe('ConfusionMatrixTable', () => {
  it('renders a labelled HTML table with axis headers', () => {
    renderWithProviders(<ConfusionMatrixTable matrix={baseMatrix} />);
    expect(
      screen.getByRole('table', { name: /Friction confusion matrix/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Predicted: low risk/i).length).toBeGreaterThan(
      0
    );
    expect(screen.getByText(/Actual: friction-free/i)).toBeInTheDocument();
  });

  it('renders TP/TN/FP/FN cells with counts and percentages', () => {
    renderWithProviders(<ConfusionMatrixTable matrix={baseMatrix} />);
    expect(screen.getByText(/TP 8/)).toBeInTheDocument();
    expect(screen.getByText(/TN 6/)).toBeInTheDocument();
    expect(screen.getByText(/FP 3/)).toBeInTheDocument();
    expect(screen.getByText(/FN 3/)).toBeInTheDocument();
    // Percentages: 8/20=40%, 6/20=30%, 3/20=15%
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getAllByText('15%').length).toBeGreaterThanOrEqual(2);
  });

  it('shows precision and recall as percentages', () => {
    renderWithProviders(<ConfusionMatrixTable matrix={baseMatrix} />);
    expect(screen.getByText(/Precision \(low risk\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Recall \(low risk\)/i)).toBeInTheDocument();
    // 8/11 = 0.7272... → formatted as 72.7%
    expect(screen.getAllByText('72.7%').length).toBeGreaterThanOrEqual(2);
  });

  it('renders n/a for precision/recall when denominator is 0', () => {
    const empty: ConfusionMatrix = {
      truePositive: 0,
      trueNegative: 0,
      falsePositive: 0,
      falseNegative: 0,
      precisionLowRisk: null,
      recallLowRisk: null,
      total: 0,
    };
    renderWithProviders(<ConfusionMatrixTable matrix={empty} />);
    expect(screen.getAllByText('n/a').length).toBeGreaterThanOrEqual(2);
  });
});
