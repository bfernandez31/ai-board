import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { HealthModuleCard } from '@/components/health/health-module-card';
import type { HealthModuleStatus, TrendDataPoint } from '@/lib/health/types';

// Mock Recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="sparkline">{children}</div>,
  Line: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const neverScanned: HealthModuleStatus = {
  score: null,
  label: null,
  lastScanDate: null,
  scanStatus: null,
  issuesFound: null,
  summary: 'No scan yet',
};

const completed: HealthModuleStatus = {
  score: 85,
  label: 'Good',
  lastScanDate: '2026-03-27T14:30:00Z',
  scanStatus: 'COMPLETED',
  issuesFound: 3,
  summary: '3 issues found',
};

const failed: HealthModuleStatus = {
  score: null,
  label: null,
  lastScanDate: null,
  scanStatus: 'FAILED',
  issuesFound: null,
  summary: 'Scan failed',
};

describe('HealthModuleCard', () => {
  it('renders "never scanned" state with "Run first scan" button', () => {
    renderWithProviders(
      <HealthModuleCard moduleType="SECURITY" module={neverScanned} />
    );
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('No scan yet')).toBeInTheDocument();
    expect(screen.getByText('Run scan')).toBeInTheDocument();
    expect(screen.getAllByText('---').length).toBeGreaterThanOrEqual(1);
  });

  it('renders "scanning" state with disabled button and spinner text', () => {
    renderWithProviders(
      <HealthModuleCard moduleType="TESTS" module={neverScanned} isScanning={true} />
    );
    expect(screen.getByText('Tests')).toBeInTheDocument();
    expect(screen.getAllByText('Scanning...').length).toBeGreaterThanOrEqual(1);
    const scanningBtn = screen.getAllByRole('button', { name: /scanning/i })
      .find(el => el.tagName === 'BUTTON')!;
    expect(scanningBtn).toBeDisabled();
  });

  it('renders "completed" state with score and "Re-run scan" button', () => {
    renderWithProviders(
      <HealthModuleCard moduleType="SECURITY" module={completed} />
    );
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('3 issues found')).toBeInTheDocument();
    expect(screen.getByText('Re-run')).toBeInTheDocument();
  });

  it('renders "failed" state with "Retry" button', () => {
    renderWithProviders(
      <HealthModuleCard moduleType="COMPLIANCE" module={failed} />
    );
    expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('renders passive module without action button', () => {
    const passive: HealthModuleStatus = {
      score: 75,
      label: 'Good',
      lastScanDate: null,
      passive: true,
      summary: 'From latest verify job',
    };
    renderWithProviders(
      <HealthModuleCard moduleType="QUALITY_GATE" module={passive} />
    );
    expect(screen.getByText('Quality Gate')).toBeInTheDocument();
    expect(screen.getByText('passive')).toBeInTheDocument();
    const buttons = screen.queryAllByRole('button').filter(el => el.tagName === 'BUTTON');
    expect(buttons).toHaveLength(0);
  });

  describe('sparkline rendering', () => {
    const trendData3: TrendDataPoint[] = [
      { score: 70, date: '2026-03-25T10:00:00Z' },
      { score: 75, date: '2026-03-26T10:00:00Z' },
      { score: 80, date: '2026-03-27T10:00:00Z' },
    ];

    const trendData2: TrendDataPoint[] = [
      { score: 70, date: '2026-03-25T10:00:00Z' },
      { score: 75, date: '2026-03-26T10:00:00Z' },
    ];

    it('renders sparkline when trendData has >= 3 data points', () => {
      renderWithProviders(
        <HealthModuleCard moduleType="SECURITY" module={completed} trendData={trendData3} />
      );
      expect(screen.getByTestId('sparkline')).toBeInTheDocument();
    });

    it('hides sparkline when trendData has < 3 data points', () => {
      renderWithProviders(
        <HealthModuleCard moduleType="SECURITY" module={completed} trendData={trendData2} />
      );
      expect(screen.queryByTestId('sparkline')).not.toBeInTheDocument();
    });

    it('hides sparkline for passive modules', () => {
      const passive: HealthModuleStatus = {
        score: 75,
        label: 'Good',
        lastScanDate: null,
        passive: true,
        summary: 'From latest verify job',
      };
      renderWithProviders(
        <HealthModuleCard moduleType="QUALITY_GATE" module={passive} trendData={trendData3} />
      );
      expect(screen.queryByTestId('sparkline')).not.toBeInTheDocument();
    });
  });

  it('calls onTriggerScan when action button is clicked', async () => {
    const onTriggerScan = vi.fn();
    const { container } = renderWithProviders(
      <HealthModuleCard
        moduleType="SECURITY"
        module={neverScanned}
        onTriggerScan={onTriggerScan}
      />
    );
    const button = screen.getByText('Run scan');
    button.click();
    expect(onTriggerScan).toHaveBeenCalledOnce();
  });
});
