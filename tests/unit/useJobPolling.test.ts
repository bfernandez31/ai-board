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

  it('should invalidate tickets cache when a job disappears (completed)', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // API only returns active jobs. First poll: RUNNING, second poll: empty (job completed).
    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      const jobs: JobStatusDto[] = callCount === 1
        ? [{ id: 1, ticketId: 10, status: 'RUNNING', updatedAt: new Date().toISOString() }]
        : [];

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

    // Wait for first poll (RUNNING status)
    await waitFor(() => expect(result.current.jobs.length).toBe(1), { timeout: 1000 });

    // Wait for second poll (job disappeared — completed)
    await waitFor(() => expect(result.current.jobs.length).toBe(0), { timeout: 1000 });

    // Verify invalidateQueries was called with correct query key
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets'],
      exact: true,
    }), { timeout: 1000 });
  });

  it('should NOT invalidate cache on initial load', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Initial load with empty response (no active jobs)
    global.fetch = vi.fn(() => {
      return Promise.resolve({
        ok: true,
        json: async () => ({ jobs: [] }),
      } as Response);
    });

    const { result } = renderHook(() => useJobPolling(1, 100), {
      wrapper: ({ children }) => (
        React.createElement(QueryClientProvider, { client: queryClient }, children)
      ),
    });

    await waitFor(() => expect(result.current.jobs).toEqual([]), { timeout: 1000 });

    // Wait a bit to ensure no invalidation happens
    await new Promise(resolve => setTimeout(resolve, 200));

    // Should NOT invalidate on initial load (no jobs disappeared)
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

    // Should NOT invalidate (job is still active, just changed status)
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('should invalidate cache for multiple jobs disappearing simultaneously', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      const jobs: JobStatusDto[] = callCount === 1
        ? [
            { id: 1, ticketId: 10, status: 'RUNNING', updatedAt: new Date().toISOString() },
            { id: 2, ticketId: 11, status: 'RUNNING', updatedAt: new Date().toISOString() },
          ]
        : [];

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

    // Should invalidate tickets cache once
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets'],
      exact: true,
    });
  });

  it('should invalidate ticketJobs and individual ticket cache when a job disappears', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      const jobs: JobStatusDto[] = callCount === 1
        ? [{ id: 1, ticketId: 10, status: 'RUNNING', updatedAt: new Date().toISOString() }]
        : [];

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

    // Wait for first poll (RUNNING status)
    await waitFor(() => expect(result.current.jobs.length).toBe(1), { timeout: 1000 });

    // Wait for second poll (job disappeared)
    await waitFor(() => expect(result.current.jobs.length).toBe(0), { timeout: 1000 });

    // Verify all three caches were invalidated
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(3), { timeout: 1000 });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets'],
      exact: true,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets', 10, 'jobs'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets', 10],
    });
  });

  it('should invalidate ticketJobs for each disappeared job in multiple jobs scenario', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      const jobs: JobStatusDto[] = callCount === 1
        ? [
            { id: 1, ticketId: 10, status: 'RUNNING', updatedAt: new Date().toISOString() },
            { id: 2, ticketId: 20, status: 'RUNNING', updatedAt: new Date().toISOString() },
          ]
        : [];

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

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(5), { timeout: 1000 });

    // Should invalidate tickets once
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets'],
      exact: true,
    });

    // Should invalidate ticketJobs for ticket 10
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets', 10, 'jobs'],
    });

    // Should invalidate ticketJobs for ticket 20
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets', 20, 'jobs'],
    });

    // Should invalidate individual ticket cache for ticket 10
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets', 10],
    });

    // Should invalidate individual ticket cache for ticket 20
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets', 20],
    });
  });

  it('should invalidate caches when a tracked job transitions to COMPLETED (not disappeared)', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Simulates the tracked-job-ID behaviour: job stays in response but status changes
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

    const { result } = renderHook(() => useJobPolling(1, 100), {
      wrapper: ({ children }) => (
        React.createElement(QueryClientProvider, { client: queryClient }, children)
      ),
    });

    // Wait for first poll (RUNNING)
    await waitFor(() => expect(result.current.jobs.length).toBe(1), { timeout: 1000 });
    expect(result.current.jobs[0].status).toBe('RUNNING');

    // Wait for second poll (COMPLETED — job still present but terminal)
    await waitFor(() => expect(result.current.jobs[0]?.status).toBe('COMPLETED'), { timeout: 1000 });

    // Should have invalidated: tickets, ticketJobs(10), ticket(10)
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(3), { timeout: 1000 });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets'],
      exact: true,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets', 10, 'jobs'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets', 10],
    });
  });

  it('should invalidate caches when a new workflow job appears mid-stream (auto-mode chain)', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Simulates the auto-mode race: poll 1 sees specify RUNNING, poll 2 sees specify
    // COMPLETED + a fresh plan job that the server-side hook just dispatched. Without
    // this invalidation, the tickets cache stays stuck on SPECIFY visually until the
    // plan job itself terminates.
    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      const jobs: JobStatusDto[] =
        callCount === 1
          ? [
              {
                id: 1,
                ticketId: 10,
                status: 'RUNNING',
                command: 'specify',
                updatedAt: new Date().toISOString(),
              },
            ]
          : [
              {
                id: 1,
                ticketId: 10,
                status: 'COMPLETED',
                command: 'specify',
                updatedAt: new Date().toISOString(),
              },
              {
                id: 2,
                ticketId: 10,
                status: 'RUNNING',
                command: 'plan',
                updatedAt: new Date().toISOString(),
              },
            ];

      return Promise.resolve({
        ok: true,
        json: async () => ({ jobs }),
      } as Response);
    });

    const { result } = renderHook(() => useJobPolling(1, 100), {
      wrapper: ({ children }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    });

    await waitFor(() => expect(result.current.jobs.length).toBe(1), { timeout: 1000 });
    await waitFor(() => expect(result.current.jobs.length).toBe(2), { timeout: 1000 });

    // Tickets cache must be invalidated so the new PLAN stage shows immediately.
    await waitFor(
      () =>
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['projects', 1, 'tickets'],
          exact: true,
        }),
      { timeout: 1000 }
    );
  });

  it('should NOT invalidate cache when a new comment-* job appears (AI-BOARD comment)', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // A comment-* job appearing should not trigger a tickets refetch — comment jobs
    // never drive stage transitions.
    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      const jobs: JobStatusDto[] =
        callCount === 1
          ? [
              {
                id: 1,
                ticketId: 10,
                status: 'RUNNING',
                command: 'specify',
                updatedAt: new Date().toISOString(),
              },
            ]
          : [
              {
                id: 1,
                ticketId: 10,
                status: 'RUNNING',
                command: 'specify',
                updatedAt: new Date().toISOString(),
              },
              {
                id: 99,
                ticketId: 10,
                status: 'RUNNING',
                command: 'comment-specify',
                updatedAt: new Date().toISOString(),
              },
            ];

      return Promise.resolve({
        ok: true,
        json: async () => ({ jobs }),
      } as Response);
    });

    const { result } = renderHook(() => useJobPolling(1, 100), {
      wrapper: ({ children }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    });

    await waitFor(() => expect(result.current.jobs.length).toBe(2), { timeout: 1000 });
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('should keep tracking a seeded pending job so a fast FAILED transition is still observed', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    queryClient.setQueryData(['projects', 1, 'jobs', 'status'], [
      {
        id: 77,
        ticketId: 12,
        status: 'PENDING',
        command: 'specify',
        updatedAt: new Date().toISOString(),
      },
    ] satisfies JobStatusDto[]);

    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      expect(url).toContain('/api/projects/1/jobs/status?jobIds=77');

      return Promise.resolve({
        ok: true,
        json: async () => ({
          jobs: [
            {
              id: 77,
              ticketId: 12,
              status: 'FAILED',
              command: 'specify',
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      } as Response);
    });

    const { result } = renderHook(() => useJobPolling(1, 100), {
      wrapper: ({ children }) => (
        React.createElement(QueryClientProvider, { client: queryClient }, children)
      ),
    });

    await waitFor(() => expect(result.current.jobs[0]?.status).toBe('FAILED'), { timeout: 1000 });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets'],
      exact: true,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets', 12, 'jobs'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['projects', 1, 'tickets', 12],
    });
  });
});
