import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSetupJobPolling } from '@/app/lib/hooks/useSetupJobPolling';
import React from 'react';

function makeWrapper(queryClient: QueryClient) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function setupJobResponse(
  job: { status: string; errorMessage?: string | null } | null,
  configSyncedAt: string | null = null
) {
  return Promise.resolve({
    ok: true,
    json: async () => ({ job, configSyncedAt }),
  } as Response);
}

describe('useSetupJobPolling', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('exposes job and configSyncedAt from the API response', async () => {
    global.fetch = vi.fn(() =>
      setupJobResponse({ status: 'RUNNING' }, null)
    );

    const { result } = renderHook(() => useSetupJobPolling(1, 100), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.job).not.toBeNull(), { timeout: 1000 });

    expect(result.current.job?.status).toBe('RUNNING');
    expect(result.current.configSyncedAt).toBeNull();
  });

  it('exposes errorMessage on the job when the API includes it', async () => {
    global.fetch = vi.fn(() =>
      setupJobResponse({ status: 'COMPLETED', errorMessage: 'Config sync failed: file not found' })
    );

    const { result } = renderHook(() => useSetupJobPolling(1, 100), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.job?.errorMessage).toBeTruthy(), { timeout: 1000 });

    expect(result.current.job?.status).toBe('COMPLETED');
    expect(result.current.job?.errorMessage).toBe('Config sync failed: file not found');
  });

  it('stops polling when job is COMPLETED with errorMessage', async () => {
    global.fetch = vi.fn(() =>
      setupJobResponse({ status: 'COMPLETED', errorMessage: 'Config sync failed: validation error' })
    );

    renderHook(() => useSetupJobPolling(1, 100), {
      wrapper: makeWrapper(queryClient),
    });

    // Wait for the initial fetch
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1), { timeout: 1000 });

    // Wait past the polling interval — polling must not trigger a second fetch
    await new Promise((r) => setTimeout(r, 250));

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('continues polling when job is COMPLETED without errorMessage (waiting for configSyncedAt)', async () => {
    global.fetch = vi.fn(() =>
      setupJobResponse({ status: 'COMPLETED', errorMessage: null })
    );

    renderHook(() => useSetupJobPolling(1, 100), {
      wrapper: makeWrapper(queryClient),
    });

    // Polling must fire more than once since configSyncedAt is still null
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2), { timeout: 1000 });
  });

  it('stops polling when configSyncedAt is set', async () => {
    global.fetch = vi.fn(() =>
      setupJobResponse({ status: 'COMPLETED', errorMessage: null }, '2026-04-22T10:00:00Z')
    );

    renderHook(() => useSetupJobPolling(1, 100), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1), { timeout: 1000 });

    await new Promise((r) => setTimeout(r, 250));

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('stops polling when job is FAILED', async () => {
    global.fetch = vi.fn(() =>
      setupJobResponse({ status: 'FAILED', errorMessage: 'Build step failed' })
    );

    renderHook(() => useSetupJobPolling(1, 100), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1), { timeout: 1000 });

    await new Promise((r) => setTimeout(r, 250));

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps polling when job is null (no job dispatched yet)', async () => {
    global.fetch = vi.fn(() => setupJobResponse(null));

    renderHook(() => useSetupJobPolling(1, 100), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2), { timeout: 1000 });
  });

  it('keeps polling while job is PENDING', async () => {
    global.fetch = vi.fn(() =>
      setupJobResponse({ status: 'PENDING' })
    );

    renderHook(() => useSetupJobPolling(1, 100), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2), { timeout: 1000 });
  });

  it('surfaces fetch errors via the error field', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network failure')));

    const { result } = renderHook(() => useSetupJobPolling(1, 100), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.error).not.toBeNull(), { timeout: 1000 });

    expect(result.current.error?.message).toBe('Network failure');
  });
});
