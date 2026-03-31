import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { TooltipProvider } from '@/components/ui/tooltip';

// We need to test the HistoryEntry rendering via DrawerHistory
// Mock the useInfiniteQuery to provide scan data
const mockUseInfiniteQuery = vi.fn();
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useInfiniteQuery: (...args: unknown[]) => mockUseInfiniteQuery(...args),
  };
});

import { DrawerHistory } from '@/components/health/drawer/drawer-history';

function renderDrawerHistory(projectId: number, moduleType: string) {
  return renderWithProviders(
    <TooltipProvider>
      <DrawerHistory projectId={projectId} moduleType={moduleType as any} />
    </TooltipProvider>
  );
}

function makeScan(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    scanType: 'SECURITY',
    status: 'COMPLETED',
    score: 85,
    issuesFound: 3,
    issuesFixed: null,
    baseCommit: 'abc1234',
    headCommit: 'def5678',
    durationMs: 45000,
    tokensUsed: 12500,
    costUsd: 0.15,
    errorMessage: null,
    startedAt: '2026-03-28T10:00:00Z',
    completedAt: '2026-03-28T10:00:45Z',
    createdAt: '2026-03-28T09:59:58Z',
    ...overrides,
  };
}

describe('DrawerHistory — HistoryEntry metrics', () => {
  it('renders 4 metric icons with formatted values', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          scans: [makeScan()],
          nextCursor: null,
          hasMore: false,
        }],
      },
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    });

    renderDrawerHistory(1, 'SECURITY');

    // Issues count
    expect(screen.getByText('3')).toBeInTheDocument();
    // Cost
    expect(screen.getByText('$0.15')).toBeInTheDocument();
    // Tokens (12500 → 12.5K)
    expect(screen.getByText('12.5K')).toBeInTheDocument();
    // Duration (45000ms → 45.0s)
    expect(screen.getByText('45.0s')).toBeInTheDocument();
    // Score
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('shows dash for null metrics', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          scans: [makeScan({
            issuesFound: null,
            tokensUsed: null,
            costUsd: null,
            durationMs: null,
          })],
          nextCursor: null,
          hasMore: false,
        }],
      },
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    });

    renderDrawerHistory(1, 'SECURITY');

    // Should show 4 dashes for null metrics (issues, cost, tokens, duration)
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });

  it('renders 4 tooltip trigger elements for metric icons', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          scans: [makeScan()],
          nextCursor: null,
          hasMore: false,
        }],
      },
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    });

    const { container } = renderDrawerHistory(1, 'SECURITY');

    // Each MetricIcon renders a tooltip trigger (span with data-state)
    const tooltipTriggers = container.querySelectorAll('[data-state="closed"]');
    expect(tooltipTriggers.length).toBe(4);
  });
});
