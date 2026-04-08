import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import { useSetupPolling } from '@/app/lib/hooks/useSetupPolling';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useSetupPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches setup status on mount', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        setupState: 'NEEDS_SETUP',
        latestJob: null,
        configSyncedAt: null,
      }),
    });

    const { result } = renderHook(() => useSetupPolling(1), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.setupState).toBe('NEEDS_SETUP');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/projects/1/setup',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('returns correct state derivation', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        setupState: 'IN_PROGRESS',
        latestJob: {
          id: 1,
          agent: 'CLAUDE',
          status: 'RUNNING',
          logs: null,
          artifactSummary: null,
          startedAt: new Date().toISOString(),
          completedAt: null,
        },
        configSyncedAt: null,
      }),
    });

    const { result } = renderHook(() => useSetupPolling(1), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.setupState).toBe('IN_PROGRESS');
      expect(result.current.latestJob?.status).toBe('RUNNING');
      expect(result.current.isPolling).toBe(true);
    });
  });

  it('stops polling on terminal state (CONFIGURED)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        setupState: 'CONFIGURED',
        latestJob: null,
        configSyncedAt: new Date().toISOString(),
      }),
    });

    const { result } = renderHook(() => useSetupPolling(1), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.setupState).toBe('CONFIGURED');
      expect(result.current.isPolling).toBe(false);
    });
  });

  it('stops polling on FAILED state', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        setupState: 'FAILED',
        latestJob: {
          id: 1,
          agent: 'CLAUDE',
          status: 'FAILED',
          logs: 'Some error',
          artifactSummary: null,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
        configSyncedAt: null,
      }),
    });

    const { result } = renderHook(() => useSetupPolling(1), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.setupState).toBe('FAILED');
      expect(result.current.isPolling).toBe(false);
    });
  });
});
