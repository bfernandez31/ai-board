import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { HealthHero } from '@/components/health/health-hero';
import type { HealthResponse } from '@/lib/health/types';

function makeModules(overrides: Partial<HealthResponse['modules']> = {}): HealthResponse['modules'] {
  const defaultModule = {
    score: null,
    label: null,
    lastScanDate: null,
    scanStatus: null,
    issuesFound: null,
    summary: 'No scan yet',
  };

  return {
    security: { ...defaultModule },
    compliance: { ...defaultModule },
    tests: { ...defaultModule },
    specSync: { ...defaultModule },
    qualityGate: { ...defaultModule, passive: true, summary: 'No verify jobs yet' },
    lastClean: { ...defaultModule, passive: true, summary: 'No cleanup yet' },
    ...overrides,
  };
}

describe('HealthHero', () => {
  it('shows "---" and "No data yet" when globalScore is null', () => {
    renderWithProviders(
      <HealthHero globalScore={null} modules={makeModules()} lastFullScanDate={null} />
    );
    expect(screen.getAllByText('---').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
    expect(screen.getByText('Last full scan: Never')).toBeInTheDocument();
  });

  it('shows "Excellent" for score >= 90', () => {
    renderWithProviders(
      <HealthHero globalScore={95} modules={makeModules()} lastFullScanDate={null} />
    );
    expect(screen.getByText('95')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('shows "Good" for score 70-89', () => {
    renderWithProviders(
      <HealthHero globalScore={85} modules={makeModules()} lastFullScanDate={null} />
    );
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
  });

  it('shows "Fair" for score 50-69', () => {
    renderWithProviders(
      <HealthHero globalScore={55} modules={makeModules()} lastFullScanDate={null} />
    );
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('Fair')).toBeInTheDocument();
  });

  it('shows "Poor" for score 0-49', () => {
    renderWithProviders(
      <HealthHero globalScore={25} modules={makeModules()} lastFullScanDate={null} />
    );
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('Poor')).toBeInTheDocument();
  });

  it('renders all 5 sub-score badges', () => {
    renderWithProviders(
      <HealthHero globalScore={80} modules={makeModules()} lastFullScanDate={null} />
    );
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('Tests')).toBeInTheDocument();
    expect(screen.getByText('Spec Sync')).toBeInTheDocument();
    expect(screen.getByText('Quality Gate')).toBeInTheDocument();
  });

  it('shows last full scan date', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    renderWithProviders(
      <HealthHero globalScore={80} modules={makeModules()} lastFullScanDate={yesterday} />
    );
    expect(screen.getByText('Last full scan: 1 day ago')).toBeInTheDocument();
  });
});
