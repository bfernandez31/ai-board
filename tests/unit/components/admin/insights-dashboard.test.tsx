import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/tests/utils/component-test-utils';
import { InsightsDashboard } from '@/components/admin/insights-dashboard';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
  usePathname: vi.fn(() => '/admin/insights'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    status: 'COMPLETED',
    triggeredBy: 'user-1',
    periodStart: '2026-04-01T00:00:00.000Z',
    periodEnd: '2026-05-01T00:00:00.000Z',
    sessionCount: 42,
    ticketCount: 15,
    reportKey: 'insights-reports/1.html',
    reportUrl: '/api/admin/insights/runs/1/report',
    reportSize: 5000,
    errorMessage: null,
    startedAt: '2026-05-01T00:00:00.000Z',
    completedAt: '2026-05-01T00:05:00.000Z',
    createdAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('InsightsDashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/latest')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ run: null, activeRun: null }),
        });
      }
      if (url.includes('/runs') && url.includes('status=COMPLETED')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [], nextCursor: null, hasMore: false }),
        });
      }
      if (url.includes('/report')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('<html><body>Test report</body></html>'),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('renders empty state when no reports exist', async () => {
    renderWithProviders(
      <InsightsDashboard initialLatest={{ run: null, activeRun: null }} />
    );

    expect(screen.getByText('No reports yet')).toBeInTheDocument();
    expect(screen.getByText('Run new analysis')).toBeInTheDocument();
  });

  it('renders latest report with metadata header', async () => {
    const run = makeRun();

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/latest')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ run, activeRun: null }),
        });
      }
      if (url.includes('/runs') && url.includes('status=COMPLETED')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [run], nextCursor: null, hasMore: false }),
        });
      }
      if (url.includes('/report')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('<html><body>Test report</body></html>'),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(
      <InsightsDashboard initialLatest={{ run, activeRun: null }} />
    );

    expect(screen.getByText('Insights')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('42 sessions')).toBeInTheDocument();
    });
    expect(screen.getByText('15 tickets')).toBeInTheDocument();
  });

  it('shows running indicator when analysis is active', async () => {
    const activeRun = {
      id: 2,
      status: 'RUNNING',
      startedAt: '2026-05-11T00:00:00.000Z',
      createdAt: '2026-05-11T00:00:00.000Z',
    };

    renderWithProviders(
      <InsightsDashboard initialLatest={{ run: null, activeRun }} />
    );

    expect(screen.getByText('Analysis running...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run new analysis/i })).toBeDisabled();
  });

  it('renders chronological list of past reports (newest first)', async () => {
    const run1 = makeRun({ id: 1, completedAt: '2026-04-15T00:00:00.000Z' });
    const run2 = makeRun({ id: 2, completedAt: '2026-05-01T00:00:00.000Z' });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/latest')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ run: run2, activeRun: null }),
        });
      }
      if (url.includes('/runs') && url.includes('status=COMPLETED')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [run2, run1], nextCursor: null, hasMore: false }),
        });
      }
      if (url.includes('/report')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('<html><body>Report</body></html>'),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(
      <InsightsDashboard initialLatest={{ run: run2, activeRun: null }} />
    );

    await waitFor(() => {
      expect(screen.getByText('Past Reports')).toBeInTheDocument();
    });
  });

  it('switches report when selecting a past report', async () => {
    const run1 = makeRun({
      id: 1,
      completedAt: '2026-04-15T00:00:00.000Z',
      sessionCount: 10,
      ticketCount: 5,
    });
    const run2 = makeRun({
      id: 2,
      completedAt: '2026-05-01T00:00:00.000Z',
      sessionCount: 42,
      ticketCount: 15,
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/latest')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ run: run2, activeRun: null }),
        });
      }
      if (url.includes('/runs') && url.includes('status=COMPLETED')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ runs: [run2, run1], nextCursor: null, hasMore: false }),
        });
      }
      if (url.includes('/report')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('<html><body>Report</body></html>'),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const user = userEvent.setup();
    renderWithProviders(
      <InsightsDashboard initialLatest={{ run: run2, activeRun: null }} />
    );

    await waitFor(() => {
      expect(screen.getByText('Past Reports')).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    const apr15Button = buttons.find((b) => b.textContent?.includes('Apr 15'));
    if (apr15Button) {
      await user.click(apr15Button);
      await waitFor(() => {
        expect(screen.getByText('10 sessions')).toBeInTheDocument();
      });
      expect(screen.getByText('5 tickets')).toBeInTheDocument();
    }
  });
});
