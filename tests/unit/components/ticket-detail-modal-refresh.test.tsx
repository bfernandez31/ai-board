/**
 * RTL Component Tests: TicketDetailModal - Data Refresh
 *
 * Tests for ticket modal data refresh behavior.
 * Verifies that ticket data is refetched when modal opens,
 * ensuring fresh data is displayed (branch, spec button, stats).
 *
 * Related to: AIB-124
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTicket } from '@/app/lib/hooks/queries/useTickets';
import React from 'react';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('TicketDetailModal - Data Refresh', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  describe('useTicket hook with enabled parameter', () => {
    it('should not fetch when enabled is false', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      renderHook(() => useTicket(1, 1, false), { wrapper });

      // Wait a bit to ensure no fetch is triggered
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch when enabled is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          ticketNumber: 1,
          ticketKey: 'TEST-1',
          title: 'Test Ticket',
          description: 'Test description',
          stage: 'SPECIFY',
          version: 1,
          projectId: 1,
          branch: 'test-branch',
          autoMode: false,
          clarificationPolicy: null,
          workflowType: 'FULL',
          attachments: null,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useTicket(1, 1, true), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/1/tickets/1',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should refetch when modal opens (enabled changes from false to true)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 1,
          ticketNumber: 1,
          ticketKey: 'TEST-1',
          title: 'Test Ticket',
          description: 'Test description',
          stage: 'SPECIFY',
          version: 1,
          projectId: 1,
          branch: 'test-branch',
          autoMode: false,
          clarificationPolicy: null,
          workflowType: 'FULL',
          attachments: null,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Start with enabled=false (modal closed)
      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useTicket(1, 1, enabled),
        { wrapper, initialProps: { enabled: false } }
      );

      // Verify no fetch when disabled
      expect(mockFetch).not.toHaveBeenCalled();

      // Open modal (enabled=true)
      rerender({ enabled: true });

      // Wait for fetch to complete
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.current.data?.branch).toBe('test-branch');
    });

    it('should default to enabled=true when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          ticketNumber: 1,
          ticketKey: 'TEST-1',
          title: 'Test Ticket',
          description: 'Test description',
          stage: 'SPECIFY',
          version: 1,
          projectId: 1,
          branch: 'test-branch',
          autoMode: false,
          clarificationPolicy: null,
          workflowType: 'FULL',
          attachments: null,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Call without enabled parameter - should default to true
      const { result } = renderHook(() => useTicket(1, 1), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.current.data?.branch).toBe('test-branch');
    });
  });
});
