import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from '@/tests/utils/component-test-utils';
import { DrawerHistory } from '@/components/health/drawer/drawer-history';
import type { ScanHistoryItem } from '@/lib/health/types';

function makeScan(overrides: Partial<ScanHistoryItem> & { id: number }): ScanHistoryItem {
  return {
    id: overrides.id,
    scanType: 'SECURITY',
    status: 'COMPLETED',
    score: 85,
    issuesFound: 0,
    issuesFixed: null,
    baseCommit: 'abcdef1234567890',
    headCommit: '1234567890abcdef',
    durationMs: 5000,
    tokensUsed: 0,
    costUsd: 0,
    errorMessage: null,
    startedAt: '2026-03-27T14:29:00Z',
    completedAt: '2026-03-27T14:30:00Z',
    createdAt: '2026-03-27T14:29:00Z',
    ...overrides,
  };
}

const SCANS: ScanHistoryItem[] = [
  makeScan({ id: 30, issuesFound: 0, score: 95, completedAt: '2026-04-15T10:00:00Z' }),
  makeScan({ id: 29, issuesFound: 1, score: 80, completedAt: '2026-04-10T10:00:00Z' }),
  makeScan({ id: 28, issuesFound: 5, score: 45, completedAt: '2026-04-05T10:00:00Z' }),
];

function mockFetchOnce(scans: ScanHistoryItem[]) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ scans, nextCursor: null, hasMore: false }),
  }) as unknown as typeof fetch;
}

describe('DrawerHistory', () => {
  beforeEach(() => {
    mockFetchOnce(SCANS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders one row per scan with date and score', async () => {
    renderWithProviders(
      <DrawerHistory projectId={1} moduleType="SECURITY" />
    );

    await waitFor(() => expect(screen.getByText('Scan History')).toBeInTheDocument());

    expect(screen.getByText('95')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('does NOT render cost or token columns', async () => {
    renderWithProviders(
      <DrawerHistory projectId={1} moduleType="SECURITY" />
    );
    await waitFor(() => expect(screen.getByText('Scan History')).toBeInTheDocument());

    expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cost in USD/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tokens consumed/i)).not.toBeInTheDocument();
  });

  it('colors issue counts using friction levels (low/med/high)', async () => {
    renderWithProviders(
      <DrawerHistory projectId={1} moduleType="SECURITY" />
    );
    await waitFor(() => expect(screen.getByText('Scan History')).toBeInTheDocument());

    const zeroIssue = screen.getByLabelText('0 issues found');
    expect(zeroIssue.className).toMatch(/ab-level-low\b/);
    expect(zeroIssue.className).toMatch(/ab-badge-attr-tc\b/);

    const oneIssue = screen.getByLabelText('1 issues found');
    expect(oneIssue.className).toMatch(/ab-level-med\b/);

    const fiveIssues = screen.getByLabelText('5 issues found');
    expect(fiveIssues.className).toMatch(/ab-level-high\b/);
  });

  it('renders rows as buttons when onSelectScan is provided', async () => {
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        onSelectScan={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText('Scan History')).toBeInTheDocument());

    const rows = screen.getAllByRole('button');
    // 3 rows; no "Load more" because hasMore=false
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it('marks the latest row as selected when selectedScanId is null', async () => {
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        onSelectScan={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText('Scan History')).toBeInTheDocument());

    const buttons = screen.getAllByRole('button');
    const pressedRows = buttons.filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressedRows).toHaveLength(1);
    // Latest row contains the highest score (95)
    expect(pressedRows[0]).toHaveTextContent('95');
  });

  it('calls onSelectScan with the scan id when a non-latest row is clicked', async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        onSelectScan={onSelect}
      />
    );
    await waitFor(() => expect(screen.getByText('Scan History')).toBeInTheDocument());

    const user = userEvent.setup();
    const buttons = screen.getAllByRole('button');
    // The third row is the oldest scan (id=28)
    await user.click(buttons[2]!);
    expect(onSelect).toHaveBeenCalledWith(28);
  });

  it('calls onSelectScan with null when clicking the latest row (toggle back)', async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={28}
        onSelectScan={onSelect}
      />
    );
    await waitFor(() => expect(screen.getByText('Scan History')).toBeInTheDocument());

    const user = userEvent.setup();
    const buttons = screen.getAllByRole('button');
    // The first row is the latest scan (id=30)
    await user.click(buttons[0]!);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('keyboard activation: Enter triggers selection', async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="SECURITY"
        selectedScanId={null}
        onSelectScan={onSelect}
      />
    );
    await waitFor(() => expect(screen.getByText('Scan History')).toBeInTheDocument());

    const user = userEvent.setup();
    const buttons = screen.getAllByRole('button');
    buttons[1]!.focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(29);
  });

  it('renders rows as non-interactive divs when onSelectScan is omitted', async () => {
    renderWithProviders(
      <DrawerHistory projectId={1} moduleType="SECURITY" />
    );
    await waitFor(() => expect(screen.getByText('Scan History')).toBeInTheDocument());

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
