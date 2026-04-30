import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { CalibrationDashboard } from '@/components/calibration/calibration-dashboard';
import type { CalibrationDashboardData } from '@/lib/calibration/types';

vi.mock('recharts', async () => {
  const actual =
    await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

const FIXTURE: CalibrationDashboardData = {
  windowSize: 30,
  totalRows: 47,
  warmingUp: false,
  confusionMatrix: {
    truePositive: 14,
    trueNegative: 8,
    falsePositive: 5,
    falseNegative: 3,
    precisionLowRisk: 14 / 19,
    recallLowRisk: 14 / 17,
    total: 30,
  },
  qualityDistribution: {
    hit: 12,
    miss: 6,
    na: 12,
    total: 30,
    hitRate: 12 / 18,
  },
  costDistribution: {
    hit: 22,
    miss: 7,
    na: 1,
    total: 30,
    hitRate: 22 / 29,
  },
  recommendation: {
    matchedRate: 23 / 30,
    frictionAlignedRate: 18 / 30,
    counts: { matched: 23, frictionAligned: 18 },
  },
  adoption: {
    analyzed: 89,
    sinceFeatureAvailable: 142,
    ratio: 89 / 142,
  },
  generatedAt: '2026-05-12T14:32:11.000Z',
};

describe('CalibrationDashboard', () => {
  it('renders the four panels with caption when warmingUp=false', () => {
    renderWithProviders(
      <CalibrationDashboard projectId={1} initialData={FIXTURE} />
    );
    expect(
      screen.getByText(/30 of 47 shipped\+analyzed tickets/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Friction confusion matrix/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Quality verdict distribution/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Cost verdict distribution/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Recommendation calibration/i)).toBeInTheDocument();
    expect(screen.getByText(/Analysis adoption/i)).toBeInTheDocument();
  });

  it('renders "still warming up" indicator when warmingUp=true', () => {
    const data: CalibrationDashboardData = {
      ...FIXTURE,
      windowSize: 5,
      totalRows: 5,
      warmingUp: true,
    };
    renderWithProviders(
      <CalibrationDashboard projectId={1} initialData={data} />
    );
    expect(screen.getByTestId('calibration-warming-up')).toBeInTheDocument();
    expect(
      screen.getByText(/5 of 30 shipped\+analyzed tickets paired so far/i)
    ).toBeInTheDocument();
  });
});
