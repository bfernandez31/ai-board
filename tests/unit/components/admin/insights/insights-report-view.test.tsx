import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { InsightsReportView } from '@/components/admin/insights/insights-report-view';
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
    githubActionsUrl: null,
    ...overrides,
  };
}

describe('InsightsReportView (US1, AIB-791)', () => {
  it('renders the sandboxed iframe with src pointing at the html endpoint', () => {
    const latest = makeReport({ id: 42 });
    renderWithProviders(
      <InsightsReportView
        reports={[latest]}
        latest={latest}
        preflight={{
          canTrigger: false,
          shippedSincePreviousRun: 0,
          previousRunEnd: latest.periodEnd,
          runningSince: null,
          refusal: {
            refusalCode: 'NO_NEW_SHIPPED',
            message: `No new shipped tickets since last run on ${latest.periodEnd}`,
          },
        }}
      />
    );

    const iframe = screen.getByTitle('Insights report 42') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe('/api/admin/insights/reports/42/html');
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
  });

  it('renders the canonical metadata phrasing from the row counts', () => {
    const latest = makeReport({ sessionsCount: 12, ticketsCount: 4 });
    renderWithProviders(
      <InsightsReportView
        reports={[latest]}
        latest={latest}
        preflight={{
          canTrigger: false,
          shippedSincePreviousRun: 0,
          previousRunEnd: latest.periodEnd,
          runningSince: null,
          refusal: {
            refusalCode: 'NO_NEW_SHIPPED',
            message: `No new shipped tickets since last run on ${latest.periodEnd}`,
          },
        }}
      />
    );
    expect(
      screen.getByText(
        /Analyzed 12 Claude Code sessions across 4 tickets shipped between 2026-05-04 and 2026-05-11/
      )
    ).toBeInTheDocument();
  });

  it('renders the empty-state placeholder when no reports exist', () => {
    renderWithProviders(
      <InsightsReportView
        reports={[]}
        latest={null}
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
    expect(screen.getByText(/No Insights reports yet/i)).toBeInTheDocument();
  });

  it('renders the FAILED placeholder when the latest entry is FAILED', () => {
    const failed = makeReport({
      status: 'FAILED',
      errorReason: 'Workflow dispatch failed',
    });
    renderWithProviders(
      <InsightsReportView
        reports={[failed]}
        latest={failed}
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
    expect(screen.getByText(/This run failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Workflow dispatch failed/)).toBeInTheDocument();
  });

  it('renders side-by-side layout with left pane and right pane (FR-004)', () => {
    const latest = makeReport({ id: 10 });
    renderWithProviders(
      <InsightsReportView
        reports={[latest]}
        latest={latest}
        preflight={{
          canTrigger: false,
          shippedSincePreviousRun: 0,
          previousRunEnd: latest.periodEnd,
          runningSince: null,
          refusal: {
            refusalCode: 'NO_NEW_SHIPPED',
            message: 'No new shipped tickets',
          },
        }}
      />
    );

    const aside = document.querySelector('aside');
    expect(aside).toBeInTheDocument();
    const main = document.querySelector('main');
    expect(main).toBeInTheDocument();
  });

  it('does not render an H1 title (FR-003)', () => {
    const latest = makeReport({ id: 10 });
    renderWithProviders(
      <InsightsReportView
        reports={[latest]}
        latest={latest}
        preflight={{
          canTrigger: false,
          shippedSincePreviousRun: 0,
          previousRunEnd: latest.periodEnd,
          runningSince: null,
          refusal: {
            refusalCode: 'NO_NEW_SHIPPED',
            message: 'No new shipped tickets',
          },
        }}
      />
    );
    expect(document.querySelector('h1')).not.toBeInTheDocument();
  });

  it('displays duration for COMPLETED reports with completedAt (FR-007)', () => {
    const latest = makeReport({
      id: 10,
      createdAt: '2026-05-11T12:00:00.000Z',
      completedAt: '2026-05-11T12:03:30.000Z',
    });
    renderWithProviders(
      <InsightsReportView
        reports={[latest]}
        latest={latest}
        preflight={{
          canTrigger: false,
          shippedSincePreviousRun: 0,
          previousRunEnd: latest.periodEnd,
          runningSince: null,
          refusal: {
            refusalCode: 'NO_NEW_SHIPPED',
            message: 'No new shipped tickets',
          },
        }}
      />
    );
    expect(screen.getByText('3m 30s')).toBeInTheDocument();
  });

  it('hides duration when completedAt is null', () => {
    const running = makeReport({
      id: 10,
      status: 'RUNNING',
      completedAt: null,
      sessionsCount: null,
      ticketsCount: null,
    });
    renderWithProviders(
      <InsightsReportView
        reports={[running]}
        latest={running}
        preflight={{
          canTrigger: false,
          shippedSincePreviousRun: 0,
          previousRunEnd: null,
          runningSince: running.createdAt,
          refusal: {
            refusalCode: 'ALREADY_RUNNING',
            message: 'Already running',
          },
        }}
      />
    );
    expect(screen.queryByText(/\d+m \d+s/)).not.toBeInTheDocument();
  });

  it('FAILED report shows GitHub Actions link when githubActionsUrl is present (FR-012)', () => {
    const failed = makeReport({
      id: 5,
      status: 'FAILED',
      errorReason: 'Workflow dispatch failed',
      githubActionsUrl: 'https://github.com/org/repo/actions/runs/12345',
      workflowRunId: '12345',
    });
    renderWithProviders(
      <InsightsReportView
        reports={[failed]}
        latest={failed}
        preflight={{
          canTrigger: true,
          shippedSincePreviousRun: 3,
          previousRunEnd: null,
          runningSince: null,
          refusal: null,
        }}
      />
    );
    const link = screen.getByText('View GitHub Actions run');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute(
      'href',
      'https://github.com/org/repo/actions/runs/12345'
    );
    expect(link.closest('a')).toHaveAttribute('target', '_blank');
  });

  it('FAILED report hides GitHub Actions link when githubActionsUrl is null (FR-014)', () => {
    const failed = makeReport({
      id: 5,
      status: 'FAILED',
      errorReason: 'Workflow dispatch failed',
      githubActionsUrl: null,
      workflowRunId: null,
    });
    renderWithProviders(
      <InsightsReportView
        reports={[failed]}
        latest={failed}
        preflight={{
          canTrigger: true,
          shippedSincePreviousRun: 3,
          previousRunEnd: null,
          runningSince: null,
          refusal: null,
        }}
      />
    );
    expect(screen.queryByText('View GitHub Actions run')).not.toBeInTheDocument();
  });

  it('FAILED report shows retry button (FR-015)', () => {
    const failed = makeReport({
      id: 5,
      status: 'FAILED',
      errorReason: 'Workflow dispatch failed',
    });
    renderWithProviders(
      <InsightsReportView
        reports={[failed]}
        latest={failed}
        preflight={{
          canTrigger: true,
          shippedSincePreviousRun: 3,
          previousRunEnd: null,
          runningSince: null,
          refusal: null,
        }}
      />
    );
    expect(screen.getByRole('button', { name: /retry analysis/i })).toBeInTheDocument();
  });
});
