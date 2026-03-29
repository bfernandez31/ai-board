import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ScanHistorySection } from '@/components/health/scan-history-section';

vi.mock('@/app/lib/hooks/useScanHistory', () => ({
  useScanHistory: vi.fn((projectId: number, moduleType: string) => {
    if (moduleType === 'SECURITY') {
      return {
        data: {
          scans: [
            {
              id: 3,
              scanType: 'SECURITY',
              status: 'COMPLETED',
              score: 90,
              issuesFound: 1,
              issuesFixed: 0,
              baseCommit: 'aaa1111111',
              headCommit: 'bbb2222222',
              durationMs: 20000,
              errorMessage: null,
              startedAt: '2026-03-29T10:00:00Z',
              completedAt: '2026-03-29T10:00:20Z',
              createdAt: '2026-03-29T10:00:00Z',
            },
            {
              id: 2,
              scanType: 'SECURITY',
              status: 'COMPLETED',
              score: 75,
              issuesFound: 3,
              issuesFixed: 1,
              baseCommit: 'ccc3333333',
              headCommit: 'ddd4444444',
              durationMs: 30000,
              errorMessage: null,
              startedAt: '2026-03-28T10:00:00Z',
              completedAt: '2026-03-28T10:00:30Z',
              createdAt: '2026-03-28T10:00:00Z',
            },
          ],
          nextCursor: null,
          hasMore: false,
        },
        isLoading: false,
      };
    }
    if (moduleType === 'COMPLIANCE') {
      return {
        data: { scans: [{ id: 1, createdAt: '2026-03-29T10:00:00Z', score: 80, status: 'COMPLETED', issuesFound: 2, baseCommit: null, headCommit: null }], nextCursor: null, hasMore: false },
        isLoading: false,
      };
    }
    return { data: { scans: [] }, isLoading: false };
  }),
}));

describe('ScanHistorySection', () => {
  it('renders scan history with scores and dates', () => {
    renderWithProviders(
      <ScanHistorySection projectId={1} moduleType="SECURITY" enabled={true} />
    );

    expect(screen.getByText('Scan History')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('1 issue')).toBeInTheDocument();
    expect(screen.getByText('3 issues')).toBeInTheDocument();
    expect(screen.getByText(/aaa1111/)).toBeInTheDocument();
  });

  it('returns null when only 1 scan exists', () => {
    const { container } = renderWithProviders(
      <ScanHistorySection projectId={1} moduleType="COMPLIANCE" enabled={true} />
    );

    expect(screen.queryByText('Scan History')).not.toBeInTheDocument();
  });

  it('returns null when no scans exist', () => {
    renderWithProviders(
      <ScanHistorySection projectId={1} moduleType="TESTS" enabled={true} />
    );

    expect(screen.queryByText('Scan History')).not.toBeInTheDocument();
  });
});
