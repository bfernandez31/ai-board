import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJobPolling } from '@/app/lib/hooks/useJobPolling';
import type { JobStatusDto } from '@/app/lib/schemas/job-polling';
import React from 'react';

describe('useJobPolling - Cache Invalidation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    vi.clearAllMocks();
  });

  it('should invalidate tickets cache when job transitions to COMPLETED', async () => {
    // Spy on invalidateQueries
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Mock fetch to return job with RUNNING status, then COMPLETED
    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      const jobs: JobStatusDto[] = callCount === 1
        ? [{ id: 1, ticketId: 10, status: 'RUNNING', updatedAt: new Date().toISOString() }]
        : [{ id: 1, ticketId: 10, status: 'COMPLETED', updatedAt: new Date().toISOString() }];

      return Promise.resolve({
        ok: true,
        json: async () => ({ jobs }),
      } as Response);
    });

    // Render hook
    const { result } = renderHook(() => useJobPolling(1, 100), {
      wrapper: ({ children }) => (
        React.createElement(QueryClientProvider, { client: queryClient }, children)
      ),
    });

    // Wait for first poll (RUNNING status)
    await waitFor(() => expect(result.current.jobs.length).toBe(1), { timeout: 1000 });

    // Wait for second poll (COMPLETED status)
    await waitFor(() => expect(result.current.jobs[0]?.status).toBe('COMPLETED'), { timeout: 1000 });

    // Verify invalidateQueries was called with correct query key
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets'],
    }), { timeout: 1000 });
  });

  it('should NOT invalidate cache on initial load', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    global.fetch = vi.fn(() => {
      const jobs: JobStatusDto[] = [
        { id: 1, ticketId: 10, status: 'COMPLETED', updatedAt: new Date().toISOString() },
      ];
      return Promise.resolve({
        ok: true,
        json: async () => ({ jobs }),
      } as Response);
    });

    const { result } = renderHook(() => useJobPolling(1, 100), {
      wrapper: ({ children }) => (
        React.createElement(QueryClientProvider, { client: queryClient }, children)
      ),
    });

    await waitFor(() => expect(result.current.jobs.length).toBe(1), { timeout: 1000 });

    // Wait a bit to ensure no invalidation happens
    await new Promise(resolve => setTimeout(resolve, 200));

    // Should NOT invalidate on initial load (job was already COMPLETED)
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('should NOT invalidate cache when job transitions from PENDING to RUNNING', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      const jobs: JobStatusDto[] = callCount === 1
        ? [{ id: 1, ticketId: 10, status: 'PENDING', updatedAt: new Date().toISOString() }]
        : [{ id: 1, ticketId: 10, status: 'RUNNING', updatedAt: new Date().toISOString() }];

      return Promise.resolve({
        ok: true,
        json: async () => ({ jobs }),
      } as Response);
    });

    renderHook(() => useJobPolling(1, 100), {
      wrapper: ({ children }) => (
        React.createElement(QueryClientProvider, { client: queryClient }, children)
      ),
    });

    // Wait for two polls to happen
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2), { timeout: 500 });

    // Wait a bit to ensure no invalidation happens
    await new Promise(resolve => setTimeout(resolve, 200));

    // Should NOT invalidate (neither PENDING nor RUNNING is terminal)
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('should invalidate cache for multiple jobs transitioning simultaneously', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      const jobs: JobStatusDto[] = callCount === 1
        ? [
            { id: 1, ticketId: 10, status: 'RUNNING', updatedAt: new Date().toISOString() },
            { id: 2, ticketId: 11, status: 'RUNNING', updatedAt: new Date().toISOString() },
          ]
        : [
            { id: 1, ticketId: 10, status: 'COMPLETED', updatedAt: new Date().toISOString() },
            { id: 2, ticketId: 11, status: 'FAILED', updatedAt: new Date().toISOString() },
          ];

      return Promise.resolve({
        ok: true,
        json: async () => ({ jobs }),
      } as Response);
    });

    renderHook(() => useJobPolling(1, 100), {
      wrapper: ({ children }) => (
        React.createElement(QueryClientProvider, { client: queryClient }, children)
      ),
    });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled(), { timeout: 1000 });

    // Should only invalidate once (even though multiple jobs transitioned)
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets'],
    });
  });
});
