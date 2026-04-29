import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  screen,
  waitFor,
  userEvent,
} from '@/tests/utils/component-test-utils';
import { DrawerHistory } from '@/components/health/drawer/drawer-history';
import type { ScanHistoryItem } from '@/lib/health/types';

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function makeScan(overrides: Partial<ScanHistoryItem> = {}): ScanHistoryItem {
  return {
    id: 100,
    scanType: 'COMPLIANCE',
    status: 'COMPLETED',
    score: 80,
    issuesFound: 0,
    issuesFixed: 0,
    baseCommit: 'aaaaaaaaaaaa1111',
    headCommit: 'bbbbbbbbbbbb2222',
    durationMs: 5000,
    tokensUsed: 12345,
    costUsd: 0.5 as unknown as number,
    errorMessage: null,
    startedAt: '2026-04-29T10:00:00.000Z',
    completedAt: '2026-04-29T10:00:05.000Z',
    createdAt: '2026-04-29T10:00:00.000Z',
    ...overrides,
  };
}

function mockHistoryResponse(scans: ScanHistoryItem[]) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        scans,
        nextCursor: null,
        hasMore: false,
      }),
  });
}

describe('DrawerHistory', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('case 1: renders one button per scan', async () => {
    const scans = [
      makeScan({ id: 1, score: 90 }),
      makeScan({ id: 2, score: 80 }),
      makeScan({ id: 3, score: 70 }),
    ];
    mockHistoryResponse(scans);

    const onSelect = vi.fn();
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="COMPLIANCE"
        selectedScanId={null}
        latestScanId={1}
        onSelect={onSelect}
      />
    );

    await waitFor(() => {
      const rowButtons = screen.getAllByRole('button', {
        name: /scan from/i,
      });
      expect(rowButtons).toHaveLength(3);
    });
  });

  it('case 2: does not render cost ($) or token-count text on rows', async () => {
    mockHistoryResponse([
      makeScan({ id: 1, costUsd: 1.23 as unknown as number, tokensUsed: 9876 }),
    ]);

    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="COMPLIANCE"
        selectedScanId={null}
        latestScanId={1}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /scan from/i })
      ).toBeInTheDocument();
    });

    expect(screen.queryByText('$')).toBeNull();
    expect(screen.queryByText(/^\$/)).toBeNull();
    expect(screen.queryByText(/tokens?$/i)).toBeNull();
    // Verify date / commit-range / duration / score still render
    expect(screen.getByText(/aaaaaaa\.\.bbbbbbb/)).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('case 3: row with issuesFound=0 renders a friction-low badge', async () => {
    mockHistoryResponse([makeScan({ id: 1, issuesFound: 0 })]);

    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="COMPLIANCE"
        selectedScanId={null}
        latestScanId={1}
        onSelect={vi.fn()}
      />
    );

    const badge = await screen.findByLabelText(/0 issues/i);
    expect(badge.className).toContain('ab-level-low');
  });

  it('case 4: rows with issuesFound=1 and 2 render friction-med badges', async () => {
    mockHistoryResponse([
      makeScan({ id: 1, issuesFound: 1 }),
      makeScan({ id: 2, issuesFound: 2 }),
    ]);

    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="COMPLIANCE"
        selectedScanId={null}
        latestScanId={1}
        onSelect={vi.fn()}
      />
    );

    const badge1 = await screen.findByLabelText(/1 issue$/i);
    const badge2 = await screen.findByLabelText(/2 issues/i);
    expect(badge1.className).toContain('ab-level-med');
    expect(badge2.className).toContain('ab-level-med');
  });

  it('case 5: rows with issuesFound=3 and 5 render friction-high badges', async () => {
    mockHistoryResponse([
      makeScan({ id: 1, issuesFound: 3 }),
      makeScan({ id: 2, issuesFound: 5 }),
    ]);

    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="COMPLIANCE"
        selectedScanId={null}
        latestScanId={1}
        onSelect={vi.fn()}
      />
    );

    const badge3 = await screen.findByLabelText(/3 issues/i);
    const badge5 = await screen.findByLabelText(/5 issues/i);
    expect(badge3.className).toContain('ab-level-high');
    expect(badge5.className).toContain('ab-level-high');
  });

  it('case 6: clicking a non-latest row calls onSelect(scan.id)', async () => {
    const scans = [
      makeScan({ id: 10, score: 90 }),
      makeScan({ id: 7, score: 60 }),
    ];
    mockHistoryResponse(scans);

    const onSelect = vi.fn();
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="COMPLIANCE"
        selectedScanId={null}
        latestScanId={10}
        onSelect={onSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /scan from/i })).toHaveLength(
        2
      );
    });

    const buttons = screen.getAllByRole('button', { name: /scan from/i });
    await userEvent.click(buttons[1]!);
    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it('case 7: pressing Enter on a focused row calls onSelect(scan.id)', async () => {
    const scans = [makeScan({ id: 42 })];
    mockHistoryResponse(scans);

    const onSelect = vi.fn();
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="COMPLIANCE"
        selectedScanId={null}
        latestScanId={42}
        onSelect={onSelect}
      />
    );

    const button = await screen.findByRole('button', { name: /scan from/i });
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(42);
  });

  it('case 8: pressing Space on a focused row calls onSelect(scan.id)', async () => {
    const scans = [makeScan({ id: 99 })];
    mockHistoryResponse(scans);

    const onSelect = vi.fn();
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="COMPLIANCE"
        selectedScanId={null}
        latestScanId={99}
        onSelect={onSelect}
      />
    );

    const button = await screen.findByRole('button', { name: /scan from/i });
    button.focus();
    await userEvent.keyboard(' ');
    expect(onSelect).toHaveBeenCalledWith(99);
  });

  it('case 9: row with selectedScanId === scan.id has aria-pressed="true"', async () => {
    const scans = [makeScan({ id: 1 }), makeScan({ id: 2 })];
    mockHistoryResponse(scans);

    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="COMPLIANCE"
        selectedScanId={2}
        latestScanId={1}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /scan from/i })).toHaveLength(
        2
      );
    });
    const buttons = screen.getAllByRole('button', { name: /scan from/i });
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('case 10: "Latest" button is disabled when selectedScanId === null', async () => {
    mockHistoryResponse([makeScan({ id: 1 })]);

    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="COMPLIANCE"
        selectedScanId={null}
        latestScanId={1}
        onSelect={vi.fn()}
      />
    );

    const latest = await screen.findByRole('button', {
      name: /return to latest scan/i,
    });
    expect(latest).toBeDisabled();
  });

  it('case 11: "Latest" enabled when selectedScanId !== null and clicking calls onSelect(null)', async () => {
    mockHistoryResponse([makeScan({ id: 1 }), makeScan({ id: 2 })]);

    const onSelect = vi.fn();
    renderWithProviders(
      <DrawerHistory
        projectId={1}
        moduleType="COMPLIANCE"
        selectedScanId={2}
        latestScanId={1}
        onSelect={onSelect}
      />
    );

    const latest = await screen.findByRole('button', {
      name: /return to latest scan/i,
    });
    expect(latest).not.toBeDisabled();
    await userEvent.click(latest);
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
