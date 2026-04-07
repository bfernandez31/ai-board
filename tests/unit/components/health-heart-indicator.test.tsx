import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { HealthHeartIndicator } from '@/components/projects/health-heart-indicator';
import type { ProjectHealthScore } from '@/app/lib/types/project';

const fullScore: ProjectHealthScore = {
  globalScore: 85,
  securityScore: 90,
  complianceScore: 80,
  testsScore: 75,
  specSyncScore: 88,
  qualityGate: 72,
  reviewQualityScore: 95,
};

const partialScore: ProjectHealthScore = {
  globalScore: 60,
  securityScore: 55,
  complianceScore: null,
  testsScore: 70,
  specSyncScore: null,
  qualityGate: null,
  reviewQualityScore: 65,
};

describe('HealthHeartIndicator', () => {
  it('renders greyed-out heart with "—" when healthScore is null', () => {
    renderWithProviders(<HealthHeartIndicator healthScore={null} />);
    const heart = screen.getByTestId('health-heart-indicator');
    expect(heart).toBeInTheDocument();
    expect(heart).toHaveAttribute('aria-label', 'No health data');
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders greyed-out heart with "—" when globalScore is null', () => {
    const noGlobal: ProjectHealthScore = {
      globalScore: null,
      securityScore: null,
      complianceScore: null,
      testsScore: null,
      specSyncScore: null,
      qualityGate: null,
      reviewQualityScore: null,
    };
    renderWithProviders(<HealthHeartIndicator healthScore={noGlobal} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByTestId('health-heart-indicator')).toHaveAttribute(
      'aria-label',
      'No health data'
    );
  });

  it('displays the global score inside the heart', () => {
    renderWithProviders(<HealthHeartIndicator healthScore={fullScore} />);
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByTestId('health-heart-indicator')).toHaveAttribute(
      'aria-label',
      'Health score: 85'
    );
  });

  it('shows popover with all 6 sub-scores on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HealthHeartIndicator healthScore={fullScore} />);

    await user.click(screen.getByTestId('health-heart-indicator'));

    expect(screen.getByText('Health Sub-Scores')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('Tests')).toBeInTheDocument();
    expect(screen.getByText('Spec Sync')).toBeInTheDocument();
    expect(screen.getByText('Quality Gate')).toBeInTheDocument();
    expect(screen.getByText('Review Quality')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument();
  });

  it('shows "—" for sub-scores with no data in popover', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HealthHeartIndicator healthScore={partialScore} />);

    await user.click(screen.getByTestId('health-heart-indicator'));

    expect(screen.getByText('Health Sub-Scores')).toBeInTheDocument();
    // 3 null sub-scores + the global "60" displayed in the heart
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(3);
  });

  it('applies correct color for excellent score (90+)', () => {
    const excellent: ProjectHealthScore = { ...fullScore, globalScore: 95 };
    renderWithProviders(<HealthHeartIndicator healthScore={excellent} />);
    const svg = screen.getByTestId('health-heart-indicator').querySelector('svg');
    expect(svg?.className.baseVal || svg?.getAttribute('class')).toContain('fill-ctp-green');
  });

  it('applies correct color for good score (70-89)', () => {
    renderWithProviders(<HealthHeartIndicator healthScore={fullScore} />);
    const svg = screen.getByTestId('health-heart-indicator').querySelector('svg');
    expect(svg?.className.baseVal || svg?.getAttribute('class')).toContain('fill-ctp-blue');
  });

  it('applies correct color for fair score (50-69)', () => {
    renderWithProviders(<HealthHeartIndicator healthScore={partialScore} />);
    const svg = screen.getByTestId('health-heart-indicator').querySelector('svg');
    expect(svg?.className.baseVal || svg?.getAttribute('class')).toContain('fill-ctp-yellow');
  });

  it('applies correct color for poor score (0-49)', () => {
    const poor: ProjectHealthScore = { ...fullScore, globalScore: 30 };
    renderWithProviders(<HealthHeartIndicator healthScore={poor} />);
    const svg = screen.getByTestId('health-heart-indicator').querySelector('svg');
    expect(svg?.className.baseVal || svg?.getAttribute('class')).toContain('fill-ctp-red');
  });

  it('stops click propagation to prevent card navigation', async () => {
    const user = userEvent.setup();
    let cardClicked = false;
    renderWithProviders(
      <div onClick={() => { cardClicked = true; }}>
        <HealthHeartIndicator healthScore={fullScore} />
      </div>
    );

    await user.click(screen.getByTestId('health-heart-indicator'));
    expect(cardClicked).toBe(false);
  });
});
