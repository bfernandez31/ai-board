import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { ProjectComparisonLaunchSheet } from '@/components/comparison/project-comparison-launch-sheet';

function LaunchSheetHost({
  candidateCount = 2,
}: {
  candidateCount?: number;
}) {
  const [selectedTicketIds, setSelectedTicketIds] = useState<number[]>([]);
  const onLaunch = vi.fn();

  const candidates = Array.from({ length: candidateCount }, (_, index) => ({
    id: index + 1,
    ticketKey: `AIB-${index + 1}`,
    title: `Candidate ${index + 1}`,
    stage: 'VERIFY' as const,
    updatedAt: '2026-03-27T00:00:00.000Z',
    branch: null,
    qualityScore: { state: 'available' as const, value: 80 + index },
  }));

  return (
    <>
      <ProjectComparisonLaunchSheet
        open
        onOpenChange={() => undefined}
        candidates={candidates}
        selectedTicketIds={selectedTicketIds}
        pendingLaunches={[]}
        onSelectionChange={setSelectedTicketIds}
        onLaunch={onLaunch}
      />
      <div data-testid="selection-count">{selectedTicketIds.length}</div>
    </>
  );
}

describe('ProjectComparisonLaunchSheet', () => {
  it('shows the empty state when no VERIFY tickets are available', () => {
    renderWithProviders(
      <ProjectComparisonLaunchSheet
        open
        onOpenChange={() => undefined}
        candidates={[]}
        selectedTicketIds={[]}
        pendingLaunches={[]}
        onSelectionChange={() => undefined}
        onLaunch={() => undefined}
      />
    );

    expect(
      screen.getByText('No VERIFY tickets are ready for a comparison launch.')
    ).toBeInTheDocument();
  });

  it('requires at least two selected tickets before launch is enabled', async () => {
    const user = userEvent.setup();

    renderWithProviders(<LaunchSheetHost />);

    const launchButton = screen.getByRole('button', { name: /Launch comparison/i });
    expect(launchButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /AIB-1/i }));
    expect(screen.getByTestId('selection-count')).toHaveTextContent('1');
    expect(launchButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /AIB-2/i }));
    expect(screen.getByTestId('selection-count')).toHaveTextContent('2');
    expect(launchButton).toBeEnabled();
  });
});
