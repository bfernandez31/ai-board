import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { RunAnalysisButton } from '@/components/admin/insights/run-analysis-button';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RunAnalysisButton (US3, AIB-791)', () => {
  it('is disabled when canTrigger=false and shows the refusal message', () => {
    renderWithProviders(
      <RunAnalysisButton
        preflight={{
          canTrigger: false,
          refusal: { refusalCode: 'NO_NEW_SHIPPED', message: 'No new shipped tickets' },
        }}
        latestIsRunning={false}
      />
    );

    const button = screen.getByRole('button', { name: /run new analysis/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/No new shipped tickets/)).toBeInTheDocument();
  });

  it('is disabled when latestIsRunning', () => {
    renderWithProviders(
      <RunAnalysisButton
        preflight={{ canTrigger: true, refusal: null }}
        latestIsRunning={true}
      />
    );
    expect(screen.getByRole('button', { name: /run new analysis/i })).toBeDisabled();
  });

  it('POSTs the trigger endpoint on click and shows the 409 refusal message', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 409,
      json: async () => ({ message: 'Already running since 2026-05-11' }),
    });

    renderWithProviders(
      <RunAnalysisButton
        preflight={{ canTrigger: true, refusal: null }}
        latestIsRunning={false}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /run new analysis/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/insights/trigger',
      expect.objectContaining({ method: 'POST' })
    );
    await waitFor(() =>
      expect(screen.getByText(/Already running since/)).toBeInTheDocument()
    );
  });

  it('shows a friendly dispatch-failed message on 502', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 502,
      json: async () => ({}),
    });
    renderWithProviders(
      <RunAnalysisButton
        preflight={{ canTrigger: true, refusal: null }}
        latestIsRunning={false}
      />
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /run new analysis/i }));
    await waitFor(() =>
      expect(screen.getByText(/Workflow dispatch failed/)).toBeInTheDocument()
    );
  });

  it('shows "Retry analysis" label when retryPeriod is provided', () => {
    renderWithProviders(
      <RunAnalysisButton
        preflight={{ canTrigger: true, refusal: null }}
        latestIsRunning={false}
        retryPeriod={{
          periodStart: '2026-05-01T00:00:00.000Z',
          periodEnd: '2026-05-10T00:00:00.000Z',
        }}
      />
    );
    expect(screen.getByRole('button', { name: /retry analysis/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run new analysis/i })).not.toBeInTheDocument();
  });

  it('sends periodStart/periodEnd in POST body when retryPeriod is provided', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ id: 99, status: 'RUNNING', createdAt: new Date().toISOString() }),
    });

    renderWithProviders(
      <RunAnalysisButton
        preflight={{ canTrigger: true, refusal: null }}
        latestIsRunning={false}
        retryPeriod={{
          periodStart: '2026-05-01T00:00:00.000Z',
          periodEnd: '2026-05-10T00:00:00.000Z',
        }}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /retry analysis/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/insights/trigger',
      expect.objectContaining({ method: 'POST' })
    );

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(callBody).toEqual({
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-05-10T00:00:00.000Z',
    });
  });
});
