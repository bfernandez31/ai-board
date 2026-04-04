import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { HealthModuleCard } from '@/components/health/health-module-card';
import type { HealthModuleStatus } from '@/lib/health/types';

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

const skippedWithPreviousScore: HealthModuleStatus = {
  score: 75,
  label: 'Good',
  lastScanDate: '2026-03-20T00:00:00Z',
  scanStatus: 'SKIPPED',
  issuesFound: null,
  summary: 'Nothing to evaluate',
};

const skippedNoPreviousScore: HealthModuleStatus = {
  score: null,
  label: null,
  lastScanDate: null,
  scanStatus: 'SKIPPED',
  issuesFound: null,
  summary: 'Nothing to evaluate',
};

describe('HealthModuleCard', () => {
  it('renders "never scanned" state with "Run scan" button', () => {
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

  it('renders "completed" state with score and "Re-run" button', () => {
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

  it('renders "skipped" state with "Skipped" badge and "Re-run" button', () => {
    renderWithProviders(
      <HealthModuleCard moduleType="SECURITY" module={skippedWithPreviousScore} />
    );
    expect(screen.getByText('Skipped')).toBeInTheDocument();
    expect(screen.getByText('Nothing to evaluate')).toBeInTheDocument();
    expect(screen.getByText('Re-run')).toBeInTheDocument();
    // Previous score should still be displayed
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('renders "skipped" state with no previous score', () => {
    renderWithProviders(
      <HealthModuleCard moduleType="REVIEW_QUALITY" module={skippedNoPreviousScore} />
    );
    expect(screen.getByText('Skipped')).toBeInTheDocument();
    expect(screen.getByText('Nothing to evaluate')).toBeInTheDocument();
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
