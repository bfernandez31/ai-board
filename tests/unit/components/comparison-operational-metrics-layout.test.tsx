import { describe, expect, it } from 'vitest';
import { ComparisonOperationalMetricsGrid } from '@/components/comparison/comparison-operational-metrics-grid';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';

const participants = Array.from({ length: 6 }, (_, index) => ({
  ticketId: index + 1,
  ticketKey: `AIB-${index + 1}`,
  title: `Participant ${index + 1}`,
  stage: 'VERIFY' as const,
  workflowType: 'FULL' as const,
  agent: index % 2 === 0 ? 'CLAUDE' : 'CODEX',
  rank: index + 1,
  score: 95 - index,
  rankRationale: `Participant ${index + 1} rationale`,
  operational: {
    totalTokens: { state: 'available' as const, value: 100 + index },
    inputTokens: { state: 'available' as const, value: 60 + index },
    outputTokens: { state: 'available' as const, value: 40 },
    durationMs: { state: 'available' as const, value: 1000 + index * 100 },
    costUsd: { state: 'available' as const, value: 0.01 + index * 0.01 },
    jobCount: { state: 'available' as const, value: 1 + index },
    primaryModel: 'gpt-5.4',
    bestValueFlags: {
      totalTokens: index === 0,
      inputTokens: index === 0,
      outputTokens: index === 0,
      durationMs: index === 0,
      costUsd: index === 0,
      jobCount: index === 0,
    },
  },
  quality: {
    score: { state: 'available' as const, value: 90 - index },
    thresholdLabel: 'Excellent',
    detailAvailable: false,
    breakdown: null,
    isBestValue: index === 0,
  },
  metrics: {
    linesAdded: 10,
    linesRemoved: 2,
    linesChanged: 12,
    filesChanged: 2,
    testFilesChanged: 1,
    changedFiles: [],
    bestValueFlags: {},
  },
}));

describe('ComparisonOperationalMetricsGrid layout', () => {
  it('renders six participant columns with a sticky metric label column and horizontal overflow', () => {
    const { container } = renderWithProviders(
      <ComparisonOperationalMetricsGrid participants={participants} />
    );

    expect(screen.getByTestId('comparison-operational-scroll')).toHaveClass('overflow-x-auto');
    expect(screen.getByText('Metric')).toHaveClass('sticky');
    expect(screen.getByText('Total tokens')).toHaveClass('sticky');
    expect(screen.getByText('AIB-6')).toBeInTheDocument();
    expect(container.querySelector('table')).toHaveClass('min-w-max');
  });
});
