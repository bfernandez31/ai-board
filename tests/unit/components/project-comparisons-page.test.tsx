import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/tests/utils/component-test-utils';
import { ProjectComparisonsPage } from '@/components/comparison/project-comparisons-page';

const toastMock = vi.fn();
const launchMutateAsync = vi.fn();

vi.mock('@/components/comparison/comparison-viewer', () => ({
  ComparisonDashboard: ({ detail }: { detail: { winnerTicketKey: string } }) => (
    <div>Dashboard for {detail.winnerTicketKey}</div>
  ),
}));

vi.mock('@/components/comparison/project-comparison-launch-sheet', () => ({
  ProjectComparisonLaunchSheet: () => null,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/hooks/use-comparisons', () => ({
  comparisonKeys: {
    project: (projectId: number) => ['comparisons', projectId],
    projectCandidates: (projectId: number) => ['comparisons', projectId, 'candidates'],
  },
  useProjectComparisonList: vi.fn(),
  useProjectComparisonDetail: vi.fn(),
  useProjectComparisonCandidates: vi.fn(() => ({
    data: { candidates: [] },
    isLoading: false,
    error: null,
  })),
  useProjectComparisonLaunch: vi.fn(() => ({
    mutateAsync: launchMutateAsync,
    isPending: false,
    error: null,
  })),
  useProjectComparisonPendingJobs: vi.fn(() => ({
    data: [],
    error: null,
  })),
}));

describe('ProjectComparisonsPage', () => {
  beforeEach(async () => {
    toastMock.mockReset();
    launchMutateAsync.mockReset();

    const hooks = await import('@/hooks/use-comparisons');
    vi.mocked(hooks.useProjectComparisonList).mockReturnValue({
      data: {
        comparisons: [
          {
            id: 11,
            winnerTicketKey: 'AIB-11',
            winnerTicketTitle: 'Winner 11',
            summary: 'First summary',
          },
          {
            id: 22,
            winnerTicketKey: 'AIB-22',
            winnerTicketTitle: 'Winner 22',
            summary: 'Second summary',
          },
        ],
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    vi.mocked(hooks.useProjectComparisonDetail).mockImplementation(
      (_projectId, comparisonId) => {
        let data: { winnerTicketKey: string } | null = null;

        if (comparisonId === 22) {
          data = { winnerTicketKey: 'AIB-22' };
        } else if (comparisonId === 11) {
          data = { winnerTicketKey: 'AIB-11' };
        }

        return {
          data,
          isLoading: false,
          error: null,
        } as never;
      }
    );
  });

  it('switches the inline detail view when a different comparison is selected', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ProjectComparisonsPage projectId={1} projectName="Example Project" />
    );

    expect(screen.getByText('Dashboard for AIB-11')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /AIB-22/i }));

    await waitFor(() => {
      expect(screen.getByText('Dashboard for AIB-22')).toBeInTheDocument();
    });
  });

  it('reports recoverable query errors through toast feedback', async () => {
    const hooks = await import('@/hooks/use-comparisons');
    vi.mocked(hooks.useProjectComparisonDetail).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Detail failed'),
    } as never);

    renderWithProviders(
      <ProjectComparisonsPage projectId={1} projectName="Example Project" initialComparisonId={11} />
    );

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: 'Detail failed',
        })
      );
    });
  });
});
