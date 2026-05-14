import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    workflowRunId: null,
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
        preflight={{
          canTrigger: false,
          shippedSincePreviousRun: 0,
          previousRunEnd: null,
          runningSince: null,
          refusal: {
            refusalCode: 'NO_CLAUDE_JOBS',
            message: 'No shipped Claude tickets to analyze yet',
          },
        }}
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
        preflight={{
          canTrigger: false,
          shippedSincePreviousRun: 0,
          previousRunEnd: null,
          runningSince: null,
          refusal: {
            refusalCode: 'NO_CLAUDE_JOBS',
            message: 'No shipped Claude tickets to analyze yet',
          },
        }}
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
        preflight={{
          canTrigger: false,
          shippedSincePreviousRun: 0,
          previousRunEnd: null,
          runningSince: null,
          refusal: {
            refusalCode: 'NO_CLAUDE_JOBS',
            message: 'No shipped Claude tickets to analyze yet',
          },
        }}
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
        preflight={{
          canTrigger: false,
          shippedSincePreviousRun: 0,
          previousRunEnd: null,
          runningSince: null,
          refusal: {
            refusalCode: 'NO_CLAUDE_JOBS',
            message: 'No shipped Claude tickets to analyze yet',
          },
        }}
      />
    );
    const user = userEvent.setup();
    // The default-selected row is id=2 (passed as `latest`); the other
    // COMPLETED row (id=1) is at aria-pressed=false. Click it.
    const completedButtons = screen
      .getAllByRole('button')
      .filter((b) => b.textContent?.includes('COMPLETED'));
    const olderRow = completedButtons.find(
      (b) => b.getAttribute('aria-pressed') === 'false'
    )!;
    await user.click(olderRow);

    const iframe = screen.getByTitle('Insights report 1') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe('/api/admin/insights/reports/1/html');
  });

  it('updates aria-pressed on the selected row after clicking a non-default row (US2)', async () => {
    renderWithProviders(
      <InsightsReportView
        reports={reports}
        latest={reports[2]}
        preflight={{
          canTrigger: false,
          shippedSincePreviousRun: 0,
          previousRunEnd: null,
          runningSince: null,
          refusal: {
            refusalCode: 'NO_CLAUDE_JOBS',
            message: 'No shipped Claude tickets to analyze yet',
          },
        }}
      />
    );
    const user = userEvent.setup();
    const completedButtons = screen
      .getAllByRole('button')
      .filter((b) => b.textContent?.includes('COMPLETED'));
    const olderRow = completedButtons.find(
      (b) => b.getAttribute('aria-pressed') === 'false'
    )!;
    const previouslySelected = completedButtons.find(
      (b) => b.getAttribute('aria-pressed') === 'true'
    )!;
    await user.click(olderRow);

    expect(olderRow.getAttribute('aria-pressed')).toBe('true');
    expect(previouslySelected.getAttribute('aria-pressed')).toBe('false');
  });

  describe('FAILED row diagnostics (US3)', () => {
    beforeEach(() => {
      vi.stubEnv('GITHUB_OWNER', 'acme');
      vi.stubEnv('GITHUB_REPO', 'ai-board');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('clicking a FAILED row with workflowRunId surfaces the GH Actions link', async () => {
      const reportsWithRun: ReportListEntry[] = [
        makeReport({ id: 4, status: 'RUNNING', sessionsCount: null, ticketsCount: null }),
        makeReport({
          id: 3,
          status: 'FAILED',
          errorReason: 'Workflow step failed',
          sessionsCount: null,
          ticketsCount: null,
          workflowRunId: '12345',
        }),
        makeReport({ id: 2, status: 'COMPLETED', sessionsCount: 7, ticketsCount: 3 }),
      ];
      renderWithProviders(
        <InsightsReportView
          reports={reportsWithRun}
          latest={reportsWithRun[2]}
          preflight={{
            canTrigger: false,
            shippedSincePreviousRun: 0,
            previousRunEnd: null,
            runningSince: null,
            refusal: {
              refusalCode: 'NO_CLAUDE_JOBS',
              message: 'No shipped Claude tickets to analyze yet',
            },
          }}
        />
      );
      const user = userEvent.setup();
      const failedRow = screen.getByText('FAILED').closest('button')!;
      await user.click(failedRow);

      const link = screen.getByRole('link', { name: /workflow run/i });
      expect(link.getAttribute('href')).toBe(
        'https://github.com/acme/ai-board/actions/runs/12345'
      );
    });

    it('clicking a FAILED row with workflowRunId=null shows the fallback text and no link', async () => {
      const reportsNoRun: ReportListEntry[] = [
        makeReport({
          id: 3,
          status: 'FAILED',
          errorReason: 'Workflow step failed',
          sessionsCount: null,
          ticketsCount: null,
          workflowRunId: null,
        }),
        makeReport({ id: 2, status: 'COMPLETED', sessionsCount: 7, ticketsCount: 3 }),
      ];
      renderWithProviders(
        <InsightsReportView
          reports={reportsNoRun}
          latest={reportsNoRun[1]}
          preflight={{
            canTrigger: false,
            shippedSincePreviousRun: 0,
            previousRunEnd: null,
            runningSince: null,
            refusal: {
              refusalCode: 'NO_CLAUDE_JOBS',
              message: 'No shipped Claude tickets to analyze yet',
            },
          }}
        />
      );
      const user = userEvent.setup();
      const failedRow = screen.getByText('FAILED').closest('button')!;
      await user.click(failedRow);

      expect(
        screen.getByText(/No workflow run is associated with this report/i)
      ).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /workflow run/i })).toBeNull();
    });
  });
});
