/**
 * TicketSearch Component Tests
 *
 * Tests for keyboard navigation, debounced input, and dropdown visibility states.
 * Uses React Testing Library patterns following Testing Trophy strategy.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock next/navigation before importing component
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock the search hook
vi.mock('@/app/lib/hooks/queries/useTicketSearch', () => ({
  useTicketSearch: vi.fn(() => ({
    data: { results: [] },
    isLoading: false,
    error: null,
  })),
}));

// Now import the component and mocks
import { TicketSearch } from '@/components/search/ticket-search';
import { useRouter } from 'next/navigation';
import { useTicketSearch } from '@/app/lib/hooks/queries/useTicketSearch';

describe('TicketSearch', () => {
  let queryClient: QueryClient;
  const mockPush = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
      refresh: vi.fn(),
    });

    vi.mocked(useTicketSearch).mockReturnValue({
      data: { results: [] },
      isLoading: false,
      error: null,
      status: 'success',
      isSuccess: true,
      isFetching: false,
      isPending: false,
      isError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isStale: false,
      isPlaceholderData: false,
      isRefetching: false,
      refetch: vi.fn(),
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      fetchStatus: 'idle',
      isInitialLoading: false,
      isRefetchError: false,
      isLoadingError: false,
      promise: Promise.resolve({ results: [] }),
    });

    mockPush.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(TicketSearch, { projectId: 1 })
      )
    );
  };

  const mockSearchResults = [
    {
      ticketKey: 'TEST-1',
      title: 'First ticket',
      status: 'INBOX',
      matchType: 'key' as const,
    },
    {
      ticketKey: 'TEST-2',
      title: 'Second ticket',
      status: 'BUILD',
      matchType: 'title' as const,
    },
    {
      ticketKey: 'TEST-3',
      title: 'Third ticket',
      status: 'VERIFY',
      matchType: 'description' as const,
    },
  ];

  describe('Debounced Input Behavior', () => {
    it('should render search input', () => {
      renderComponent();

      const searchInput = screen.getByPlaceholderText(/search tickets/i);
      expect(searchInput).toBeDefined();
    });

    it('should debounce search input by 300ms', async () => {
      vi.useFakeTimers();
      renderComponent();

      const searchInput = screen.getByPlaceholderText(/search tickets/i);

      // Type quickly
      fireEvent.change(searchInput, { target: { value: 'te' } });
      fireEvent.change(searchInput, { target: { value: 'tes' } });
      fireEvent.change(searchInput, { target: { value: 'test' } });

      // Hook should not be called with intermediate values yet
      expect(useTicketSearch).toHaveBeenLastCalledWith(1, '');

      // Advance timer by 300ms
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Now the debounced value should be used
      expect(useTicketSearch).toHaveBeenLastCalledWith(1, 'test');

      vi.useRealTimers();
    });

    it('should not open dropdown for queries less than 2 characters', async () => {
      vi.useFakeTimers();
      vi.mocked(useTicketSearch).mockReturnValue({
        data: { results: mockSearchResults },
        isLoading: false,
        error: null,
        status: 'success',
        isSuccess: true,
        isFetching: false,
        isPending: false,
        isError: false,
        isFetched: true,
        isFetchedAfterMount: true,
        isStale: false,
        isPlaceholderData: false,
        isRefetching: false,
        refetch: vi.fn(),
        dataUpdatedAt: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        errorUpdateCount: 0,
        fetchStatus: 'idle',
        isInitialLoading: false,
        isRefetchError: false,
        isLoadingError: false,
        promise: Promise.resolve({ results: mockSearchResults }),
      });

      renderComponent();

      const searchInput = screen.getByPlaceholderText(/search tickets/i);

      fireEvent.change(searchInput, { target: { value: 'a' } });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Dropdown should not be visible (no results shown)
      expect(screen.queryByText('First ticket')).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should clear search text on Escape when input has text', async () => {
      vi.useFakeTimers();
      vi.mocked(useTicketSearch).mockReturnValue({
        data: { results: mockSearchResults },
        isLoading: false,
        error: null,
        status: 'success',
        isSuccess: true,
        isFetching: false,
        isPending: false,
        isError: false,
        isFetched: true,
        isFetchedAfterMount: true,
        isStale: false,
        isPlaceholderData: false,
        isRefetching: false,
        refetch: vi.fn(),
        dataUpdatedAt: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        errorUpdateCount: 0,
        fetchStatus: 'idle',
        isInitialLoading: false,
        isRefetchError: false,
        isLoadingError: false,
        promise: Promise.resolve({ results: mockSearchResults }),
      });

      renderComponent();

      const searchInput = screen.getByPlaceholderText(/search tickets/i) as HTMLInputElement;

      // Type something but don't wait for dropdown
      fireEvent.change(searchInput, { target: { value: 'a' } }); // Less than 2 chars

      // Press Escape
      fireEvent.keyDown(searchInput, { key: 'Escape' });

      expect(searchInput.value).toBe('');

      vi.useRealTimers();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label', () => {
      renderComponent();

      const searchInput = screen.getByPlaceholderText(/search tickets/i);

      expect(searchInput.getAttribute('aria-label')).toBe('Search tickets');
    });

    it('should have aria-expanded attribute', () => {
      renderComponent();

      const searchInput = screen.getByPlaceholderText(/search tickets/i);

      expect(searchInput.getAttribute('aria-expanded')).toBe('false');
    });

    it('should have aria-haspopup attribute', () => {
      renderComponent();

      const searchInput = screen.getByPlaceholderText(/search tickets/i);

      expect(searchInput.getAttribute('aria-haspopup')).toBe('listbox');
    });
  });
});
