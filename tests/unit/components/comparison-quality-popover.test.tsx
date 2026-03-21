import { describe, expect, it } from 'vitest';
import { ComparisonQualityPopover } from '@/components/comparison/comparison-quality-popover';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import type { QualityScoreDetails } from '@/lib/quality-score';

const sampleDetails: QualityScoreDetails = {
  dimensions: [
    { name: 'Compliance', agentId: 'compliance', score: 92, weight: 0.4, weightedScore: 36.8 },
    { name: 'Bug Detection', agentId: 'bug-detection', score: 85, weight: 0.3, weightedScore: 25.5 },
    { name: 'Code Comments', agentId: 'code-comments', score: 78, weight: 0.2, weightedScore: 15.6 },
    { name: 'Historical Context', agentId: 'historical-context', score: 70, weight: 0.1, weightedScore: 7.0 },
    { name: 'Spec Sync', agentId: 'spec-sync', score: 90, weight: 0.0, weightedScore: 0 },
  ],
  threshold: 'Good',
  computedAt: '2026-03-20T10:00:00.000Z',
};

describe('ComparisonQualityPopover', () => {
  it('opens popover on click showing 5 dimensions with name, score, weight, and progress bar', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ComparisonQualityPopover score={87} details={sampleDetails} workflowType="FULL" />
    );

    const trigger = screen.getByRole('button', { name: /87 Good/i });
    await user.click(trigger);

    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('Bug Detection')).toBeInTheDocument();
    expect(screen.getByText('Code Comments')).toBeInTheDocument();
    expect(screen.getByText('Historical Context')).toBeInTheDocument();
    expect(screen.getByText('Spec Sync')).toBeInTheDocument();
    // Check score values
    expect(screen.getByText('92')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    // Check weight percentages
    expect(screen.getByText('(40%)')).toBeInTheDocument();
    expect(screen.getByText('(30%)')).toBeInTheDocument();
  });

  it('shows overall score with threshold label', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ComparisonQualityPopover score={87} details={sampleDetails} workflowType="FULL" />
    );

    await user.click(screen.getByRole('button', { name: /87 Good/i }));

    expect(screen.getByText('Overall Score')).toBeInTheDocument();
    // The popover shows the overall score with threshold
    const scoreElements = screen.getAllByText(/87/);
    expect(scoreElements.length).toBeGreaterThanOrEqual(1);
  });

  it('not clickable for non-FULL workflow tickets', () => {
    renderWithProviders(
      <ComparisonQualityPopover score={87} details={sampleDetails} workflowType="QUICK" />
    );

    expect(screen.getByText('87 Good')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ComparisonQualityPopover score={87} details={sampleDetails} workflowType="FULL" />
    );

    await user.click(screen.getByRole('button', { name: /87 Good/i }));
    expect(screen.getByText('Overall Score')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    // After Escape, popover content should be removed
    expect(screen.queryByText('Overall Score')).not.toBeInTheDocument();
  });
});
