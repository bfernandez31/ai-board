import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { GlobalScoreCard } from '@/components/health/global-score-card';
import type { ModuleResponse } from '@/lib/health/types';

const emptyModules: ModuleResponse[] = [
  { type: 'SECURITY', name: 'Security', score: null, status: 'never_scanned', isPassive: false, lastScanAt: null, summary: null, latestScan: null },
  { type: 'COMPLIANCE', name: 'Compliance', score: null, status: 'never_scanned', isPassive: false, lastScanAt: null, summary: null, latestScan: null },
  { type: 'TESTS', name: 'Tests', score: null, status: 'never_scanned', isPassive: false, lastScanAt: null, summary: null, latestScan: null },
  { type: 'SPEC_SYNC', name: 'Spec Sync', score: null, status: 'never_scanned', isPassive: false, lastScanAt: null, summary: null, latestScan: null },
  { type: 'QUALITY_GATE', name: 'Quality Gate', score: null, status: 'never_scanned', isPassive: true, lastScanAt: null, summary: null, latestScan: null },
  { type: 'LAST_CLEAN', name: 'Last Clean', score: null, status: 'never_scanned', isPassive: true, lastScanAt: null, summary: null, latestScan: null },
];

describe('GlobalScoreCard', () => {
  it('displays "---" when global score is null', () => {
    renderWithProviders(
      <GlobalScoreCard globalScore={null} modules={emptyModules} lastScanAt={null} />
    );

    expect(screen.getByTestId('global-score')).toHaveTextContent('---');
  });

  it('displays score with label and color when score is present', () => {
    renderWithProviders(
      <GlobalScoreCard globalScore={85} modules={emptyModules} lastScanAt="2026-03-28T10:00:00Z" />
    );

    expect(screen.getByTestId('global-score')).toHaveTextContent('85');
    expect(screen.getByText('Good')).toBeInTheDocument();
  });

  it('shows sub-score badges for contributing modules', () => {
    const modulesWithScores: ModuleResponse[] = [
      ...emptyModules.slice(0, 1).map((m) => ({ ...m, score: 90 })),
      ...emptyModules.slice(1),
    ];

    renderWithProviders(
      <GlobalScoreCard globalScore={90} modules={modulesWithScores} lastScanAt="2026-03-28T10:00:00Z" />
    );

    expect(screen.getByText(/Security: 90/)).toBeInTheDocument();
    expect(screen.getByText(/Compliance: ---/)).toBeInTheDocument();
  });

  it('shows "No scans yet" text when lastScanAt is null', () => {
    renderWithProviders(
      <GlobalScoreCard globalScore={null} modules={emptyModules} lastScanAt={null} />
    );

    expect(screen.getByText('No scans yet')).toBeInTheDocument();
  });

  it('shows "Last full scan" text when lastScanAt is present', () => {
    renderWithProviders(
      <GlobalScoreCard globalScore={85} modules={emptyModules} lastScanAt="2026-03-28T10:00:00Z" />
    );

    expect(screen.getByText(/Last full scan/)).toBeInTheDocument();
  });
});
