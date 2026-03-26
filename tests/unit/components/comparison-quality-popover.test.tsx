import { describe, expect, it } from 'vitest';
import { ComparisonQualityPopover } from '@/components/comparison/comparison-quality-popover';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import type { QualityScoreDetails } from '@/lib/quality-score';

const mockDetails: QualityScoreDetails = {
  dimensions: [
    { name: 'Compliance', agentId: 'compliance', score: 90, weight: 0.40, weightedScore: 36 },
    { name: 'Bug Detection', agentId: 'bug-detection', score: 85, weight: 0.30, weightedScore: 25.5 },
    { name: 'Code Comments', agentId: 'code-comments', score: 80, weight: 0.20, weightedScore: 16 },
    { name: 'Historical Context', agentId: 'historical-context', score: 70, weight: 0.10, weightedScore: 7 },
    { name: 'Spec Sync', agentId: 'spec-sync', score: 60, weight: 0.00, weightedScore: 0 },
  ],
  threshold: 'Good',
  computedAt: '2026-03-24T12:00:00.000Z',
};

describe('ComparisonQualityPopover', () => {
  it('renders 5 dimension rows when popover is opened', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ComparisonQualityPopover qualityDetails={mockDetails} qualityScore={85} />
    );

    const trigger = screen.getByRole('button');
    await user.click(trigger);

    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('Bug Detection')).toBeInTheDocument();
    expect(screen.getByText('Code Comments')).toBeInTheDocument();
    expect(screen.getByText('Historical Context')).toBeInTheDocument();
    expect(screen.getByText('Spec Sync')).toBeInTheDocument();
  });

  it('shows dimension scores and weights', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ComparisonQualityPopover qualityDetails={mockDetails} qualityScore={85} />
    );

    const trigger = screen.getByRole('button');
    await user.click(trigger);

    // Scores - 85 appears twice (dimension + overall), use getAllByText
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getAllByText('85').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();

    // Weights
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows overall score with threshold label in footer', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ComparisonQualityPopover qualityDetails={mockDetails} qualityScore={85} />
    );

    const trigger = screen.getByRole('button');
    await user.click(trigger);

    expect(screen.getByTestId('quality-popover-overall')).toHaveTextContent('85');
    expect(screen.getByTestId('quality-popover-threshold')).toHaveTextContent('Good');
  });

  it('is disabled (not clickable) when qualityDetails is null', () => {
    renderWithProviders(
      <ComparisonQualityPopover qualityDetails={null} qualityScore={null} />
    );

    const trigger = screen.queryByRole('button');
    expect(trigger).not.toBeInTheDocument();
  });
});
