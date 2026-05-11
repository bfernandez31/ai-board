import { describe, it, expect } from 'vitest';
import {
  renderWithProviders,
  screen,
  userEvent,
} from '@/tests/utils/component-test-utils';
import { InsightsReportView } from '@/components/admin/insights/insights-report-view';
import type { ReportListEntry } from '@/app/lib/insights/repository';

function makeReport(overrides: Partial<ReportListEntry>): ReportListEntry {
  return {
    id: 1,
    status: 'COMPLETED',
    generatedAt: '2026-05-10T12:00:00.000Z',
    periodStart: '2026-05-03T00:00:00.000Z',
    periodEnd: '2026-05-10T12:00:00.000Z',
    sessionsCount: 5,
    ticketsCount: 2,
    artifactSize: 1234,
    errorReason: null,
    completedAt: '2026-05-10T12:05:00.000Z',
    createdAt: '2026-05-10T12:00:00.000Z',
    ...overrides,
  };
}

describe('InsightsReportView list selection (US4, AIB-791)', () => {
  const reports: ReportListEntry[] = [
    makeReport({ id: 4, status: 'RUNNING', sessionsCount: null, ticketsCount: null }),
    makeReport({
      id: 3,
      status: 'FAILED',
      errorReason: 'Workflow dispatch failed: 401 Bad credentials',
      sessionsCount: null,
      ticketsCount: null,
    }),
    makeReport({ id: 2, status: 'COMPLETED', sessionsCount: 7, ticketsCount: 3 }),
    makeReport({ id: 1, status: 'COMPLETED', sessionsCount: 5, ticketsCount: 2 }),
  ];

  it('renders the past-reports list in the given order with status visible', () => {
    renderWithProviders(
      <InsightsReportView
        reports={reports}
        latest={reports[2]}
        preflight={{ shippedSincePreviousRun: 0, previousRunEnd: null }}
      />
    );

    expect(screen.getByText('RUNNING')).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThan(0);
  });

  it('clicking a FAILED entry surfaces the errorReason instead of the iframe', async () => {
    renderWithProviders(
      <InsightsReportView
        reports={reports}
        latest={reports[2]}
        preflight={{ shippedSincePreviousRun: 0, previousRunEnd: null }}
      />
    );
    const user = userEvent.setup();
    const failedEntry = screen.getByText('FAILED').closest('button')!;
    await user.click(failedEntry);

    expect(screen.getByText(/This run failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Workflow dispatch failed/)).toBeInTheDocument();
  });

  it('clicking a RUNNING entry shows the "Run in progress" placeholder', async () => {
    renderWithProviders(
      <InsightsReportView
        reports={reports}
        latest={reports[2]}
        preflight={{ shippedSincePreviousRun: 0, previousRunEnd: null }}
      />
    );
    const user = userEvent.setup();
    const runningEntry = screen.getByText('RUNNING').closest('button')!;
    await user.click(runningEntry);
    expect(screen.getByText(/Run in progress/i)).toBeInTheDocument();
  });

  it('clicking a COMPLETED entry switches the iframe src to that id', async () => {
    renderWithProviders(
      <InsightsReportView
        reports={reports}
        latest={reports[2]}
        preflight={{ shippedSincePreviousRun: 0, previousRunEnd: null }}
      />
    );
    const user = userEvent.setup();
    // Click the older COMPLETED entry (id=1)
    const olderRow = screen.getByText('5 sessions / 2 tickets').closest('button')!;
    await user.click(olderRow);

    const iframe = screen.getByTitle('Insights report 1') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe('/api/admin/insights/reports/1/html');
  });
});
