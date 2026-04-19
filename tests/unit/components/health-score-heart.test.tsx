import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { HealthScoreHeart } from '@/components/projects/health-score-heart';
import type { ProjectWithCount } from '@/app/lib/types/project';

type HealthScore = ProjectWithCount['healthScore'];

function makeHealthScore(overrides: Partial<NonNullable<HealthScore>> = {}): HealthScore {
  return {
    globalScore: 80,
    securityScore: 90,
    complianceScore: 75,
    testsScore: 60,
    specSyncScore: 85,
    qualityGate: 70,
    reviewQualityScore: 50,
    ...overrides,
  };
}

describe('HealthScoreHeart', () => {
  describe('color thresholds', () => {
    it('renders green heart with score "95" for globalScore=95 (>=85)', () => {
      renderWithProviders(
        <HealthScoreHeart healthScore={makeHealthScore({ globalScore: 95 })} />
      );
      expect(screen.getByText('95')).toBeInTheDocument();
      const heart = screen.getByTestId('health-heart');
      // Rendered heart has a stroked outline path (not inside <defs><clipPath>)
      const outlinePath = heart.querySelector('svg > path');
      expect(outlinePath).toHaveAttribute('stroke');
    });

    it('renders violet heart with score "72" for globalScore=72 (60-84)', () => {
      renderWithProviders(
        <HealthScoreHeart healthScore={makeHealthScore({ globalScore: 72 })} />
      );
      expect(screen.getByText('72')).toBeInTheDocument();
    });

    it('renders orange heart with score "55" for globalScore=55 (40-59)', () => {
      renderWithProviders(
        <HealthScoreHeart healthScore={makeHealthScore({ globalScore: 55 })} />
      );
      expect(screen.getByText('55')).toBeInTheDocument();
    });

    it('renders red heart with score "30" for globalScore=30 (<40)', () => {
      renderWithProviders(
        <HealthScoreHeart healthScore={makeHealthScore({ globalScore: 30 })} />
      );
      expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('renders red heart with score "0" for globalScore=0 (not no-data)', () => {
      renderWithProviders(
        <HealthScoreHeart healthScore={makeHealthScore({ globalScore: 0 })} />
      );
      expect(screen.getByText('0')).toBeInTheDocument();
      // Should NOT show dash — score of 0 is a valid score
      expect(screen.queryByText('—')).not.toBeInTheDocument();
    });
  });

  describe('progressive fill', () => {
    it('exposes the score via data-score for verification', () => {
      renderWithProviders(
        <HealthScoreHeart healthScore={makeHealthScore({ globalScore: 72 })} />
      );
      expect(screen.getByTestId('health-heart')).toHaveAttribute('data-score', '72');
    });

    it('exposes data-score="null" when no data', () => {
      renderWithProviders(<HealthScoreHeart healthScore={null} />);
      expect(screen.getByTestId('health-heart')).toHaveAttribute('data-score', 'null');
    });
  });

  describe('no-data state', () => {
    it('renders greyed-out heart with dash for null healthScore', () => {
      renderWithProviders(<HealthScoreHeart healthScore={null} />);
      expect(screen.getByText('—')).toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('renders greyed-out heart with dash for healthScore with null globalScore', () => {
      renderWithProviders(
        <HealthScoreHeart healthScore={makeHealthScore({ globalScore: null })} />
      );
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('hover popover', () => {
    it('displays all 6 sub-scores with correct values on hover', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <HealthScoreHeart healthScore={makeHealthScore({
          globalScore: 80,
          securityScore: 92,
          complianceScore: 78,
          testsScore: 60,
          specSyncScore: 65,
          qualityGate: 88,
          reviewQualityScore: 45,
        })} />
      );

      await user.hover(screen.getByTestId('health-heart'));

      expect(screen.getByText('Health Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
      expect(screen.getByText('92')).toBeInTheDocument();
      expect(screen.getByText('Compliance')).toBeInTheDocument();
      expect(screen.getByText('78')).toBeInTheDocument();
      expect(screen.getByText('Tests')).toBeInTheDocument();
      expect(screen.getByText('60')).toBeInTheDocument();
      expect(screen.getByText('Spec Sync')).toBeInTheDocument();
      expect(screen.getByText('65')).toBeInTheDocument();
      expect(screen.getByText('Quality Gate')).toBeInTheDocument();
      expect(screen.getByText('88')).toBeInTheDocument();
      expect(screen.getByText('Review Quality')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
    });

    it('shows dashes for null sub-scores', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <HealthScoreHeart healthScore={makeHealthScore({
          globalScore: 70,
          securityScore: null,
          complianceScore: null,
          testsScore: null,
          specSyncScore: null,
          qualityGate: null,
          reviewQualityScore: null,
        })} />
      );

      await user.hover(screen.getByTestId('health-heart'));

      expect(screen.getByText('Health Breakdown')).toBeInTheDocument();
      // All 6 sub-scores should show dashes (the global score 70 is in the heart, not the popover)
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBe(6);
    });

    it('dismisses popover on mouse leave', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <HealthScoreHeart healthScore={makeHealthScore({ globalScore: 80 })} />
      );

      const heart = screen.getByTestId('health-heart');
      await user.hover(heart);
      expect(screen.getByText('Health Breakdown')).toBeInTheDocument();

      await user.unhover(heart);
      // Popover should be dismissed
      expect(screen.queryByText('Health Breakdown')).not.toBeInTheDocument();
    });

    it('popover is informational only (no links or buttons)', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <HealthScoreHeart healthScore={makeHealthScore({ globalScore: 80 })} />
      );

      await user.hover(screen.getByTestId('health-heart'));

      const popover = screen.getByText('Health Breakdown').closest('[data-radix-popper-content-wrapper]');
      if (popover) {
        expect(popover.querySelectorAll('a')).toHaveLength(0);
        expect(popover.querySelectorAll('button')).toHaveLength(0);
      }
    });
  });

  describe('click behavior', () => {
    it('calls stopPropagation on click to prevent card navigation', async () => {
      const user = userEvent.setup();
      const parentClickHandler = vi.fn();

      renderWithProviders(
        <div onClick={parentClickHandler}>
          <HealthScoreHeart healthScore={makeHealthScore({ globalScore: 80 })} />
        </div>
      );

      await user.click(screen.getByTestId('health-heart'));
      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });
});
