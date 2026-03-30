import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { DrawerHistory } from '@/components/health/drawer/drawer-history';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const fullDataScan = {
  id: 1,
  scanType: 'SECURITY',
  status: 'COMPLETED',
  score: 85,
  issuesFound: 3,
  issuesFixed: 1,
  baseCommit: 'abc1234',
  headCommit: 'def5678',
  durationMs: 135000,
  tokensUsed: 12300,
  costUsd: 1.23,
  errorMessage: null,
  startedAt: '2026-03-20T10:00:00.000Z',
  completedAt: '2026-03-20T10:02:15.000Z',
  createdAt: '2026-03-20T10:00:00.000Z',
};

const nullMetricsScan = {
  ...fullDataScan,
  id: 2,
  issuesFound: null,
  durationMs: null,
  tokensUsed: null,
  costUsd: null,
  score: null,
};

function setupFetch(scans: unknown[]) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ scans, nextCursor: null, hasMore: false }),
  });
}

describe('DrawerHistory enriched metrics', () => {
  it('renders 4 metric icons with formatted values', async () => {
    setupFetch([fullDataScan]);
    renderWithProviders(<DrawerHistory projectId={1} moduleType="SECURITY" />);

    await waitFor(() => {
      expect(screen.getByTitle('Issues: 3')).toBeInTheDocument();
    });
    expect(screen.getByTitle('Cost: $1.23')).toBeInTheDocument();
    expect(screen.getByTitle('Tokens: 12.3k')).toBeInTheDocument();
    expect(screen.getByTitle('Duration: 2m 15s')).toBeInTheDocument();
  });

  it('displays dash for null metric values', async () => {
    setupFetch([nullMetricsScan]);
    renderWithProviders(<DrawerHistory projectId={1} moduleType="SECURITY" />);

    await waitFor(() => {
      expect(screen.getByTitle('Issues: —')).toBeInTheDocument();
    });
    expect(screen.getByTitle('Cost: —')).toBeInTheDocument();
    expect(screen.getByTitle('Tokens: —')).toBeInTheDocument();
    expect(screen.getByTitle('Duration: —')).toBeInTheDocument();
  });

  it('renders score badge for completed scan', async () => {
    setupFetch([fullDataScan]);
    renderWithProviders(<DrawerHistory projectId={1} moduleType="SECURITY" />);

    await waitFor(() => {
      expect(screen.getByText('85')).toBeInTheDocument();
    });
  });
});
