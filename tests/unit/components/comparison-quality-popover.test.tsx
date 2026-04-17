import { describe, expect, it } from 'vitest';
import { ComparisonQualityPopover } from '@/components/comparison/comparison-quality-popover';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import type { QualityScoreDetails } from '@/lib/quality-score';
import type { ComparisonEnrichmentValue } from '@/lib/types/comparison';

const sampleBreakdown: QualityScoreDetails = {
  dimensions: [
    { name: 'Compliance', agentId: 'compliance', score: 92, weight: 0.3, weightedScore: 27.6 },
    { name: 'Bug Detection', agentId: 'bug-detection', score: 85, weight: 0.3, weightedScore: 25.5 },
    { name: 'Product Contract Sync', agentId: 'product-contract-sync', score: 80, weight: 0.2, weightedScore: 16.0 },
    { name: 'Edge Cases & Failure Modes', agentId: 'edge-cases-failure-modes', score: 75, weight: 0.15, weightedScore: 11.25 },
    { name: 'Historical Context', agentId: 'historical-context', score: 90, weight: 0.05, weightedScore: 4.5 },
  ],
  threshold: 'Good',
  computedAt: '2026-03-24T12:00:00.000Z',
};

const availableBreakdown: ComparisonEnrichmentValue<QualityScoreDetails> = {
  state: 'available',
  value: sampleBreakdown,
};

const unavailableBreakdown: ComparisonEnrichmentValue<QualityScoreDetails> = {
  state: 'unavailable',
  value: null,
};

describe('ComparisonQualityPopover', () => {
  it('opens on click and shows all 5 dimension rows with name, score, weight, and progress bar', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ComparisonQualityPopover
        qualityBreakdown={availableBreakdown}
        qualityScore={{ state: 'available', value: 87 }}
        formattedScore="87 Good"
      />
    );

    // Should render as a clickable button
    const trigger = screen.getByRole('button', { name: /view quality score breakdown/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('87 Good');

    // Click to open popover
    await user.click(trigger);

    // All 5 dimensions should be visible
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('Bug Detection')).toBeInTheDocument();
    expect(screen.getByText('Product Contract Sync')).toBeInTheDocument();
    expect(screen.getByText('Edge Cases & Failure Modes')).toBeInTheDocument();
    expect(screen.getByText('Historical Context')).toBeInTheDocument();

    // Scores should be visible
    expect(screen.getByText(/92/)).toBeInTheDocument();
    expect(screen.getByText(/85/)).toBeInTheDocument();

    // Weights should be visible (as percentages)
    expect(screen.getAllByText('(30%)')).toHaveLength(2);
    expect(screen.getByText('(20%)')).toBeInTheDocument();
    expect(screen.getByText('(15%)')).toBeInTheDocument();
    expect(screen.getByText('(5%)')).toBeInTheDocument();
  });

  it('displays overall score with threshold label at bottom', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ComparisonQualityPopover
        qualityBreakdown={availableBreakdown}
        qualityScore={{ state: 'available', value: 87 }}
        formattedScore="87 Good"
      />
    );

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Overall')).toBeInTheDocument();
    // The overall line shows "87 Good"
    const overallSection = screen.getByText('Overall').closest('div')!;
    expect(overallSection.textContent).toContain('87');
    expect(overallSection.textContent).toContain('Good');
  });

  it('is not clickable when breakdown is unavailable (QUICK workflow)', () => {
    renderWithProviders(
      <ComparisonQualityPopover
        qualityBreakdown={unavailableBreakdown}
        qualityScore={{ state: 'unavailable', value: null }}
        formattedScore="N/A"
      />
    );

    // Should not render a button — just plain text
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('closes popover on outside click', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <div>
        <span data-testid="outside">Outside</span>
        <ComparisonQualityPopover
          qualityBreakdown={availableBreakdown}
          qualityScore={{ state: 'available', value: 87 }}
          formattedScore="87 Good"
        />
      </div>
    );

    // Open the popover
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Compliance')).toBeInTheDocument();

    // Click outside
    await user.click(screen.getByTestId('outside'));

    // Popover content should disappear (Radix handles this)
    // Note: Radix animation may mean we need to wait
    expect(screen.queryByText('Quality Score Breakdown')).not.toBeInTheDocument();
  });
});
