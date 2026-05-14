import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { FailureDiagnosticsPanel } from '@/components/admin/insights/failure-diagnostics-panel';
import type { ReportListEntry } from '@/app/lib/insights/repository';

function makeFailedReport(overrides: Partial<ReportListEntry>): ReportListEntry {
  return {
    id: 33,
    status: 'FAILED',
    generatedAt: '2026-05-11T12:00:00.000Z',
    periodStart: '2026-05-04T09:00:00.000Z',
    periodEnd: '2026-05-11T12:00:00.000Z',
    sessionsCount: null,
    ticketsCount: null,
    artifactSize: null,
    errorReason: 'Workflow step failed',
    completedAt: '2026-05-11T12:01:00.000Z',
    createdAt: '2026-05-11T12:00:00.000Z',
    workflowRunId: null,
    ...overrides,
  };
}

const preflight = {
  canTrigger: false,
  refusal: null,
};

describe('FailureDiagnosticsPanel (AIB-798 US3)', () => {
  beforeEach(() => {
    vi.stubEnv('GITHUB_OWNER', 'acme');
    vi.stubEnv('GITHUB_REPO', 'ai-board');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders a single GH Actions link with target=_blank and rel=noopener noreferrer when workflowRunId is set', () => {
    const report = makeFailedReport({ workflowRunId: '12345' });
    renderWithProviders(
      <FailureDiagnosticsPanel
        report={report}
        preflight={preflight}
        latestIsRunning={false}
      />
    );
    const links = screen.getAllByRole('link', { name: /workflow run/i });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe(
      'https://github.com/acme/ai-board/actions/runs/12345'
    );
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders the fallback text and no GH Actions link when workflowRunId is null', () => {
    const report = makeFailedReport({ workflowRunId: null });
    renderWithProviders(
      <FailureDiagnosticsPanel
        report={report}
        preflight={preflight}
        latestIsRunning={false}
      />
    );
    expect(
      screen.getByText(/No workflow run is associated with this report/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /workflow run/i })).toBeNull();
  });

  it('preserves multi-line whitespace in errorReason via whitespace-pre-wrap', () => {
    const report = makeFailedReport({
      errorReason: 'line 1\nline 2\nline 3',
    });
    const { container } = renderWithProviders(
      <FailureDiagnosticsPanel
        report={report}
        preflight={preflight}
        latestIsRunning={false}
      />
    );
    const block = container.querySelector('.whitespace-pre-wrap');
    expect(block).not.toBeNull();
    expect(block?.textContent).toContain('line 1');
    expect(block?.textContent).toContain('line 2');
    expect(block?.textContent).toContain('line 3');
  });

  it('renders the Reessayer button reflecting the passed preflight (disabled when canTrigger=false)', () => {
    const report = makeFailedReport({});
    renderWithProviders(
      <FailureDiagnosticsPanel
        report={report}
        preflight={{
          canTrigger: false,
          refusal: { refusalCode: 'NO_NEW_SHIPPED', message: 'No new tickets' },
        }}
        latestIsRunning={false}
      />
    );
    const button = screen.getByRole('button', { name: /Reessayer/i });
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });

  it('renders the Reessayer button as disabled when latestIsRunning=true', () => {
    const report = makeFailedReport({});
    renderWithProviders(
      <FailureDiagnosticsPanel
        report={report}
        preflight={{ canTrigger: true, refusal: null }}
        latestIsRunning={true}
      />
    );
    const button = screen.getByRole('button', { name: /Reessayer/i });
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });

  it('shows a stable fallback message when errorReason is null', () => {
    const report = makeFailedReport({ errorReason: null });
    renderWithProviders(
      <FailureDiagnosticsPanel
        report={report}
        preflight={preflight}
        latestIsRunning={false}
      />
    );
    expect(
      screen.getByText(/Run failed without a recorded reason/i)
    ).toBeInTheDocument();
  });
});
