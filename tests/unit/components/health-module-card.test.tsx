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

describe('HealthModuleCard', () => {
  it('renders "never scanned" state with "Run first scan" button', () => {
    renderWithProviders(
      <HealthModuleCard moduleType="SECURITY" module={neverScanned} />
    );
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('No scan yet')).toBeInTheDocument();
    expect(screen.getByText('Run first scan')).toBeInTheDocument();
    expect(screen.getAllByText('---').length).toBeGreaterThanOrEqual(1);
  });

  it('renders "scanning" state with disabled button and spinner text', () => {
    renderWithProviders(
      <HealthModuleCard moduleType="TESTS" module={neverScanned} isScanning={true} />
    );
    expect(screen.getByText('Tests')).toBeInTheDocument();
    expect(screen.getAllByText('Scanning...').length).toBeGreaterThanOrEqual(1);
    const scanningBtns = screen.getAllByRole('button', { name: /scanning/i });
    // The card itself has role="button" and the scan button inside also matches
    const disabledBtn = scanningBtns.find(btn => btn.tagName === 'BUTTON');
    expect(disabledBtn).toBeDisabled();
  });

  it('renders "completed" state with score and "Re-run scan" button', () => {
    renderWithProviders(
      <HealthModuleCard moduleType="SECURITY" module={completed} />
    );
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('3 issues found')).toBeInTheDocument();
    expect(screen.getByText('Re-run scan')).toBeInTheDocument();
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
    // Only the card-level button role exists, no scan action button
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1); // Just the card div with role="button"
    expect(buttons[0].tagName).not.toBe('BUTTON'); // Not a real <button>
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
    const button = screen.getByText('Run first scan');
    button.click();
    expect(onTriggerScan).toHaveBeenCalledOnce();
  });
});
