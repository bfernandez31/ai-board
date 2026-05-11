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
});
