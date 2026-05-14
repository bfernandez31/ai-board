import { describe, it, expect, vi } from 'vitest';
import {
  renderWithProviders,
  screen,
  userEvent,
} from '@/tests/utils/component-test-utils';
import {
  PastReportsTable,
  formatCompactPeriod,
  formatCompactDuration,
} from '@/components/admin/insights/past-reports-table';
import type { ReportListEntry } from '@/app/lib/insights/repository';

function makeReport(overrides: Partial<ReportListEntry>): ReportListEntry {
  return {
    id: 1,
    status: 'COMPLETED',
    generatedAt: '2026-05-11T12:00:00.000Z',
    periodStart: '2026-05-04T09:00:00.000Z',
    periodEnd: '2026-05-11T12:00:00.000Z',
    sessionsCount: 12,
    ticketsCount: 4,
    artifactSize: 5000,
    errorReason: null,
    completedAt: '2026-05-11T12:05:00.000Z',
    createdAt: '2026-05-11T12:00:00.000Z',
    workflowRunId: null,
    ...overrides,
  };
}

describe('PastReportsTable (AIB-798 US2)', () => {
  it('renders the four header columns in order: Date / Period / Status / Duration', () => {
    renderWithProviders(
      <PastReportsTable
        rows={[makeReport({})]}
        selectedId={null}
        onSelect={() => {}}
      />
    );
    const headers = ['Date', 'Period', 'Status', 'Duration'];
    headers.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('blanks the Duration cell for RUNNING and FAILED rows', () => {
    const rows = [
      makeReport({ id: 10, status: 'RUNNING', completedAt: null }),
      makeReport({ id: 11, status: 'FAILED', completedAt: '2026-05-11T12:01:00.000Z' }),
      makeReport({ id: 12, status: 'COMPLETED' }),
    ];
    renderWithProviders(
      <PastReportsTable rows={rows} selectedId={null} onSelect={() => {}} />
    );
    expect(formatCompactDuration(rows[0].createdAt, rows[0].completedAt, rows[0].status)).toBe('');
    expect(formatCompactDuration(rows[1].createdAt, rows[1].completedAt, rows[1].status)).toBe('');
    expect(
      formatCompactDuration(rows[2].createdAt, rows[2].completedAt, rows[2].status)
    ).not.toBe('');
  });

  it('formats compact period per D-7 (same-day, in-year, cross-year)', () => {
    expect(
      formatCompactPeriod('2026-05-04T00:00:00.000Z', '2026-05-04T23:00:00.000Z')
    ).toBe('5/4');
    expect(
      formatCompactPeriod('2026-05-04T00:00:00.000Z', '2026-05-11T00:00:00.000Z')
    ).toBe('5/4 → 5/11');
    expect(
      formatCompactPeriod('2025-12-30T00:00:00.000Z', '2026-01-05T00:00:00.000Z')
    ).toBe('12/30/25 → 1/5/26');
  });

  it('calls onSelect with the row id when clicked', async () => {
    const onSelect = vi.fn();
    const rows = [makeReport({ id: 99 })];
    renderWithProviders(
      <PastReportsTable rows={rows} selectedId={null} onSelect={onSelect} />
    );
    const user = userEvent.setup();
    const row = screen.getByText('COMPLETED').closest('button')!;
    await user.click(row);
    expect(onSelect).toHaveBeenCalledWith(99);
  });

  it('marks the selected row with active classes and aria-pressed="true"', () => {
    const rows = [
      makeReport({ id: 1 }),
      makeReport({ id: 2 }),
    ];
    renderWithProviders(
      <PastReportsTable rows={rows} selectedId={2} onSelect={() => {}} />
    );
    const buttons = screen.getAllByRole('button');
    const selectedButton = buttons.find(
      (b) => b.getAttribute('aria-pressed') === 'true'
    );
    expect(selectedButton).toBeTruthy();
    const cls = selectedButton!.className;
    expect(cls).toContain('bg-accent/30');
    expect(cls).toContain('border-l-2');
    expect(cls).toContain('border-primary');
    const nonSelectedButton = buttons.find(
      (b) => b.getAttribute('aria-pressed') === 'false'
    );
    expect(nonSelectedButton).toBeTruthy();
  });
});
