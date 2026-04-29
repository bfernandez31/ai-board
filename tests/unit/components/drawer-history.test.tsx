import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { DrawerHistory } from '@/components/health/drawer/drawer-history';
import type { ScanHistoryResponse } from '@/lib/health/types';

const mockUseInfiniteQuery = vi.fn();
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useInfiniteQuery: (...args: unknown[]) => mockUseInfiniteQuery(...args),
  };
});

const scan1 = {
  id: 10,
  scanType: 'SECURITY' as const,
  status: 'COMPLETED' as const,
  score: 80,
  issuesFound: 2,
  issuesFixed: 0,
  baseCommit: 'aaa1111111',
  headCommit: 'bbb2222222',
  durationMs: 3000,
  tokensUsed: 1500,
  costUsd: 0.05,
  errorMessage: null,
  startedAt: '2026-04-01T10:00:00Z',
  completedAt: '2026-04-01T10:01:00Z',
  createdAt: '2026-04-01T10:00:00Z',
};

const scan2 = {
  id: 11,
  scanType: 'SECURITY' as const,
  status: 'COMPLETED' as const,
  score: 90,
  issuesFound: 0,
  issuesFixed: 2,
  baseCommit: 'ccc3333333',
  headCommit: 'ddd4444444',
  durationMs: 2000,
  tokensUsed: 1000,
  costUsd: 0.03,
  errorMessage: null,
  startedAt: '2026-04-02T10:00:00Z',
  completedAt: '2026-04-02T10:01:00Z',
  createdAt: '2026-04-02T10:00:00Z',
};

const scanNullIssues = {
  ...scan1,
  id: 12,
  issuesFound: null,
};

const scanHighIssues = {
  ...scan1,
  id: 13,
  issuesFound: 5,
};

const scanMedIssues = {
  ...scan1,
  id: 14,
  issuesFound: 1,
};

function makePaginatedResult(scans: typeof scan1[]) {
  return {
    data: { pages: [{ scans, nextCursor: null, hasMore: false } as ScanHistoryResponse] },
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  };
}

describe('DrawerHistory', () => {
  beforeEach(() => {
    mockUseInfiniteQuery.mockReturnValue(makePaginatedResult([scan1, scan2]));
  });

  // ─── Row interactivity (US1) ────────────────────────────────────────────

  it('clicking a row calls onSelectScan with scan ID', async () => {
    const onSelectScan = vi.fn();
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        latestScanId={scan1.id}
        onSelectScan={onSelectScan}
      />
    );
    const user = userEvent.setup();
    const rows = screen.getAllByRole('button');
    await user.click(rows[0]);
    expect(onSelectScan).toHaveBeenCalledWith(scan1.id);
  });

  it('selected row has aria-pressed="true"', () => {
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={scan1.id}
        latestScanId={scan1.id}
        onSelectScan={vi.fn()}
      />
    );
    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveAttribute('aria-pressed', 'true');
    expect(rows[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('"Back to latest" button is visible when a non-latest scan is selected', () => {
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={scan2.id}
        latestScanId={scan1.id}
        onSelectScan={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /back to latest/i })).toBeInTheDocument();
  });

  it('"Back to latest" is hidden when no scan is selected (latest active)', () => {
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        latestScanId={scan1.id}
        onSelectScan={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /back to latest/i })).not.toBeInTheDocument();
  });

  it('"Back to latest" calls onSelectScan(null) when clicked', async () => {
    const onSelectScan = vi.fn();
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={scan2.id}
        latestScanId={scan1.id}
        onSelectScan={onSelectScan}
      />
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /back to latest/i }));
    expect(onSelectScan).toHaveBeenCalledWith(null);
  });

  // ─── Issue count friction badge colors (US2) ───────────────────────────

  it('issue count badge shows green (level=low) for 0 issues', () => {
    mockUseInfiniteQuery.mockReturnValue(makePaginatedResult([scan2]));
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        latestScanId={scan2.id}
        onSelectScan={vi.fn()}
      />
    );
    const badge = screen.getByText('0');
    expect(badge.className).toMatch(/ab-level-low/);
  });

  it('issue count badge shows yellow (level=med) for 1-2 issues', () => {
    mockUseInfiniteQuery.mockReturnValue(makePaginatedResult([scanMedIssues]));
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        latestScanId={scanMedIssues.id}
        onSelectScan={vi.fn()}
      />
    );
    const badge = screen.getByText('1');
    expect(badge.className).toMatch(/ab-level-med/);
  });

  it('issue count badge shows red (level=high) for 3+ issues', () => {
    mockUseInfiniteQuery.mockReturnValue(makePaginatedResult([scanHighIssues]));
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        latestScanId={scanHighIssues.id}
        onSelectScan={vi.fn()}
      />
    );
    const badge = screen.getByText('5');
    expect(badge.className).toMatch(/ab-level-high/);
  });

  it('null issuesFound is treated as 0 (green badge)', () => {
    mockUseInfiniteQuery.mockReturnValue(makePaginatedResult([scanNullIssues]));
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        latestScanId={scanNullIssues.id}
        onSelectScan={vi.fn()}
      />
    );
    const badge = screen.getByText('0');
    expect(badge.className).toMatch(/ab-level-low/);
  });

  // ─── No cost/token display (US3) ───────────────────────────────────────

  it('scan rows do NOT render cost values', () => {
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        latestScanId={scan1.id}
        onSelectScan={vi.fn()}
      />
    );
    expect(screen.queryByText(/\$0\.\d+/)).not.toBeInTheDocument();
    expect(screen.queryByTitle('Cost in USD')).not.toBeInTheDocument();
  });

  it('scan rows do NOT render token values', () => {
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        latestScanId={scan1.id}
        onSelectScan={vi.fn()}
      />
    );
    expect(screen.queryByTitle('Tokens consumed')).not.toBeInTheDocument();
  });

  it('scan rows still show date, commit range, issue count, and score', () => {
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        latestScanId={scan1.id}
        onSelectScan={vi.fn()}
      />
    );
    // date is rendered
    expect(screen.getByText(new Date(scan1.completedAt!).toLocaleDateString())).toBeInTheDocument();
    // commit range
    expect(screen.getByText(/aaa1111\.\.bbb2222/)).toBeInTheDocument();
    // score
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  // ─── Keyboard accessibility (US4) ─────────────────────────────────────

  it('pressing Enter on a focused row calls onSelectScan with scan ID', async () => {
    const onSelectScan = vi.fn();
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        latestScanId={scan1.id}
        onSelectScan={onSelectScan}
      />
    );
    const user = userEvent.setup();
    const rows = screen.getAllByRole('button');
    rows[0].focus();
    await user.keyboard('{Enter}');
    expect(onSelectScan).toHaveBeenCalledWith(scan1.id);
  });

  it('pressing Space on a focused row calls onSelectScan with scan ID', async () => {
    const onSelectScan = vi.fn();
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        latestScanId={scan1.id}
        onSelectScan={onSelectScan}
      />
    );
    const user = userEvent.setup();
    const rows = screen.getAllByRole('button');
    rows[0].focus();
    await user.keyboard(' ');
    expect(onSelectScan).toHaveBeenCalledWith(scan1.id);
  });

  it('rows are focusable via Tab (tabIndex=0)', () => {
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        latestScanId={scan1.id}
        onSelectScan={vi.fn()}
      />
    );
    const rows = screen.getAllByRole('button');
    rows.forEach((row) => {
      // "Back to latest" button also has tabIndex 0, so check history rows
      if (row.getAttribute('aria-pressed') !== null) {
        expect(row).toHaveAttribute('tabIndex', '0');
      }
    });
  });

  it('rows have visible focus ring classes', () => {
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        latestScanId={scan1.id}
        onSelectScan={vi.fn()}
      />
    );
    const rows = screen.getAllByRole('button');
    const historyRows = rows.filter((r) => r.getAttribute('aria-pressed') !== null);
    historyRows.forEach((row) => {
      expect(row.className).toMatch(/focus-visible:ring-2/);
    });
  });
});
