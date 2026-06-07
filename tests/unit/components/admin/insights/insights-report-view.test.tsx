import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { InsightsReportView } from '@/components/admin/insights/insights-report-view';
import type { ReportListEntry } from '@/app/lib/insights/repository';
import type { InsightsPreflight } from '@/app/lib/hooks/queries/use-insights-preflight';

function makeReport(overrides: Partial<ReportListEntry>): ReportListEntry {
  return {
    id: 1,
    status: 'COMPLETED',
    generatedAt: '2026-05-11T12:00:00.000Z',
    periodStart: '2026-05-04T09:00:00.000Z',
    periodEnd: '2026-05-11T12:00:00.000Z',
    sessionsCount: 12,
    expectedSessionsCount: 12,
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

function makePreflight(overrides: Partial<InsightsPreflight> = {}): InsightsPreflight {
  return {
    canTrigger: false,
    eligibleSessionsSincePreviousRun: 0,
    previousRunEnd: null,
    runningSince: null,
    refusal: {
      refusalCode: 'NO_NEW_SESSIONS',
      message: 'No new sessions since last run',
    },
    ...overrides,
  };
}

describe('InsightsReportView (AIB-856)', () => {
  it('renders the sandboxed iframe with src pointing at the html endpoint', () => {
    const latest = makeReport({ id: 42 });
    renderWithProviders(
      <InsightsReportView
        reports={[latest]}
        latest={latest}
        preflight={makePreflight({ previousRunEnd: latest.periodEnd })}
      />
    );

    const iframe = screen.getByTitle('Insights report 42') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe('/api/admin/insights/reports/42/html');
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
  });

  it('renders the analyzed-of-expected phrasing across tickets (FR-008/FR-010)', () => {
    const latest = makeReport({ sessionsCount: 12, expectedSessionsCount: 12, ticketsCount: 4 });
    renderWithProviders(
      <InsightsReportView
        reports={[latest]}
        latest={latest}
        preflight={makePreflight({ previousRunEnd: latest.periodEnd })}
      />
    );
    expect(
      screen.getByText(
        /Analyzed 12 of 12 Claude Code sessions across 4 tickets/
      )
    ).toBeInTheDocument();
  });

  it('renders a gap-warning badge when analyzed < expected (FR-011)', () => {
    const latest = makeReport({ sessionsCount: 10, expectedSessionsCount: 12, ticketsCount: 4 });
    renderWithProviders(
      <InsightsReportView
        reports={[latest]}
        latest={latest}
        preflight={makePreflight({ previousRunEnd: latest.periodEnd })}
      />
    );
    expect(
      screen.getByText(/Analyzed 10 of 12 Claude Code sessions across 4 tickets/)
    ).toBeInTheDocument();
    expect(screen.getByText(/2 sessions unavailable/)).toBeInTheDocument();
  });

  it('does NOT render a gap-warning badge when analyzed == expected (SC-006)', () => {
    const latest = makeReport({ sessionsCount: 12, expectedSessionsCount: 12 });
    renderWithProviders(
      <InsightsReportView
        reports={[latest]}
        latest={latest}
        preflight={makePreflight({ previousRunEnd: latest.periodEnd })}
      />
    );
    expect(screen.queryByText(/unavailable/)).not.toBeInTheDocument();
  });

  it('renders the static scope note (FR-008)', () => {
    const latest = makeReport({ id: 7 });
    renderWithProviders(
      <InsightsReportView
        reports={[latest]}
        latest={latest}
        preflight={makePreflight({ previousRunEnd: latest.periodEnd })}
      />
    );
    expect(
      screen.getByText(/all Claude sessions across all projects, regardless of ticket outcome/i)
    ).toBeInTheDocument();
  });

  it('header shows sessions awaiting analysis from the renamed preflight field', () => {
    const failed = makeReport({ id: 5, status: 'FAILED', errorReason: 'x' });
    renderWithProviders(
      <InsightsReportView
        reports={[failed]}
        latest={failed}
        preflight={makePreflight({
          canTrigger: true,
          eligibleSessionsSincePreviousRun: 7,
          refusal: null,
        })}
      />
    );
    expect(screen.getByText(/Claude sessions awaiting analysis:/i)).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders the empty-state placeholder when no reports exist', () => {
    renderWithProviders(
      <InsightsReportView
        reports={[]}
        latest={null}
        preflight={makePreflight({
          refusal: {
            refusalCode: 'NO_CLAUDE_SESSIONS',
            message: 'No Claude sessions to analyze yet',
          },
        })}
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
        preflight={makePreflight({
          refusal: {
            refusalCode: 'NO_CLAUDE_SESSIONS',
            message: 'No Claude sessions to analyze yet',
          },
        })}
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
        preflight={makePreflight({ previousRunEnd: latest.periodEnd })}
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
        preflight={makePreflight({ previousRunEnd: latest.periodEnd })}
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
        preflight={makePreflight({ previousRunEnd: latest.periodEnd })}
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
      expectedSessionsCount: null,
      ticketsCount: null,
    });
    renderWithProviders(
      <InsightsReportView
        reports={[running]}
        latest={running}
        preflight={makePreflight({
          runningSince: running.createdAt,
          refusal: { refusalCode: 'ALREADY_RUNNING', message: 'Already running' },
        })}
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
        preflight={makePreflight({
          canTrigger: true,
          eligibleSessionsSincePreviousRun: 3,
          refusal: null,
        })}
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
        preflight={makePreflight({
          canTrigger: true,
          eligibleSessionsSincePreviousRun: 3,
          refusal: null,
        })}
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
        preflight={makePreflight({
          canTrigger: true,
          eligibleSessionsSincePreviousRun: 3,
          refusal: null,
        })}
      />
    );
    expect(screen.getByRole('button', { name: /retry analysis/i })).toBeInTheDocument();
  });
});
