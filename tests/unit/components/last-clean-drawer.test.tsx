import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { LastCleanDrawer } from '@/components/health/drawer/last-clean-drawer';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockData = {
  lastCleanDate: '2026-03-20T10:00:00.000Z',
  stalenessStatus: 'ok' as const,
  daysSinceClean: 9,
  filesCleaned: 12,
  remainingIssues: 3,
  summary: 'Cleaned 12 files, 3 remaining issues',
  history: [
    {
      jobId: 456,
      completedAt: '2026-03-20T10:00:00.000Z',
      filesCleaned: 12,
      remainingIssues: 3,
      summary: 'Cleaned 12 files, 3 remaining issues',
    },
    {
      jobId: 400,
      completedAt: '2026-02-15T08:30:00.000Z',
      filesCleaned: null,
      remainingIssues: null,
      summary: null,
    },
  ],
};

const emptyData = {
  lastCleanDate: null,
  stalenessStatus: null,
  daysSinceClean: null,
  filesCleaned: null,
  remainingIssues: null,
  summary: null,
  history: [],
};

function renderDrawer(isOpen: boolean, data: unknown = mockData) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
  return renderWithProviders(
    <LastCleanDrawer projectId={1} isOpen={isOpen} onClose={vi.fn()} />
  );
}

describe('LastCleanDrawer', () => {
  it('renders staleness badge with correct visual state', async () => {
    renderDrawer(true);

    await waitFor(() => {
      expect(screen.getByText('OK')).toBeInTheDocument();
    });
  });

  it('renders cleanup history list', async () => {
    renderDrawer(true);

    await waitFor(() => {
      expect(screen.getByText('Cleanup History')).toBeInTheDocument();
    });
    // Summary text appears in both summary section and history — use getAllByText
    const summaryTexts = screen.getAllByText('Cleaned 12 files, 3 remaining issues');
    expect(summaryTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('shows file count and remaining issues when available', async () => {
    renderDrawer(true);

    await waitFor(() => {
      expect(screen.getByText('12 files cleaned')).toBeInTheDocument();
    });
    expect(screen.getByText('3 remaining issues')).toBeInTheDocument();
  });

  it('hides file count when not available (graceful degradation)', async () => {
    const dataWithoutFiles = {
      ...mockData,
      filesCleaned: null,
      remainingIssues: null,
    };
    renderDrawer(true, dataWithoutFiles);

    await waitFor(() => {
      expect(screen.getByText('9 days ago')).toBeInTheDocument();
    });
    expect(screen.queryByText(/files cleaned/)).not.toBeInTheDocument();
  });

  it('shows empty state with "No cleanups yet" message', async () => {
    renderDrawer(true, emptyData);

    await waitFor(() => {
      expect(screen.getByText('No cleanups yet')).toBeInTheDocument();
    });
  });

  it('renders warning staleness badge', async () => {
    const warningData = { ...mockData, stalenessStatus: 'warning', daysSinceClean: 45 };
    renderDrawer(true, warningData);

    await waitFor(() => {
      expect(screen.getByText('Warning')).toBeInTheDocument();
    });
  });

  it('renders alert staleness badge', async () => {
    const alertData = { ...mockData, stalenessStatus: 'alert', daysSinceClean: 90 };
    renderDrawer(true, alertData);

    await waitFor(() => {
      expect(screen.getByText('Alert')).toBeInTheDocument();
    });
  });
});
