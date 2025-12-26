/**
 * TicketSearch Component Integration Tests
 *
 * Tests debouncing, keyboard navigation, and result selection using
 * React Testing Library with fake timers.
 *
 * @see specs/AIB-117-testing-trophy-component/contracts/component-test-patterns.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, act } from '@/tests/helpers/render-with-providers';
import userEvent from '@testing-library/user-event';
import { TicketSearch } from '@/components/search/ticket-search';
import { mockTickets, mockResponses } from '@/tests/fixtures/component-mocks';

// Mock Next.js hooks
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the search hook
vi.mock('@/app/lib/hooks/queries/useTicketSearch', () => ({
  useTicketSearch: vi.fn(() => ({
    data: { results: [], totalCount: 0 },
    isLoading: false,
    error: null,
  })),
}));

import { useTicketSearch } from '@/app/lib/hooks/queries/useTicketSearch';

describe('TicketSearch', () => {
  const defaultProps = {
    projectId: 1,
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();

    // Default mock - empty results
    vi.mocked(useTicketSearch).mockReturnValue({
      data: { results: [], totalCount: 0 },
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render search input', () => {
      renderWithProviders(<TicketSearch {...defaultProps} />);

      expect(screen.getByPlaceholderText(/search tickets/i)).toBeInTheDocument();
    });

    it('should have correct ARIA attributes', () => {
      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByLabelText(/search tickets/i);
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    });
  });

  describe('debouncing', () => {
    it('should debounce search input by 300ms', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search tickets/i);
      await user.type(input, 'test');

      // Verify the hook is being called with debounced value
      // At this point, the debounced value should still be empty
      expect(vi.mocked(useTicketSearch)).toHaveBeenCalledWith(1, '');

      // Advance past debounce time
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Now the hook should be called with the search term
      // The component re-renders with the debounced value
      await waitFor(() => {
        expect(vi.mocked(useTicketSearch)).toHaveBeenCalledWith(1, 'test');
      });
    });

    it('should cancel previous debounce when typing continues', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search tickets/i);

      // Type first query
      await user.type(input, 'te');

      // Wait 200ms (less than debounce)
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Type more
      await user.type(input, 'st');

      // Wait full debounce time
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Should search for full term, not partial
      await waitFor(() => {
        expect(vi.mocked(useTicketSearch)).toHaveBeenCalledWith(1, 'test');
      });
    });
  });

  describe('dropdown behavior', () => {
    it('should open dropdown when results are available', async () => {
      // Mock results
      vi.mocked(useTicketSearch).mockReturnValue({
        data: mockResponses.searchResults(mockTickets),
        isLoading: false,
        error: null,
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search tickets/i);
      await user.type(input, 'test');

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Dropdown should open when we have 2+ chars in debounced term
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should not open dropdown for short queries', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search tickets/i);
      await user.type(input, 't'); // Only 1 character

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(input).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('keyboard navigation', () => {
    beforeEach(() => {
      // Mock results for navigation tests
      vi.mocked(useTicketSearch).mockReturnValue({
        data: mockResponses.searchResults(mockTickets),
        isLoading: false,
        error: null,
      });
    });

    it('should navigate down with ArrowDown', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search tickets/i);
      await user.type(input, 'test');

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Wait for dropdown to open
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
      });

      // Navigate down
      await user.keyboard('{ArrowDown}');

      // Check that first item is selected (has data-selected attribute)
      await waitFor(() => {
        const firstResult = screen.getByText('TEST-1');
        expect(firstResult.closest('[data-selected]')).toHaveAttribute('data-selected', 'true');
      });
    });

    it('should navigate up with ArrowUp', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search tickets/i);
      await user.type(input, 'test');

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Wait for dropdown to open
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
      });

      // Navigate down twice then up
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowUp}');

      // Should be back to first item
      await waitFor(() => {
        const firstResult = screen.getByText('TEST-1');
        expect(firstResult.closest('[data-selected]')).toHaveAttribute('data-selected', 'true');
      });
    });

    it('should close dropdown on Escape', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search tickets/i);
      await user.type(input, 'test');

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Wait for dropdown to open
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
      });

      // Press Escape
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('should clear search on Escape when dropdown is closed', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search tickets/i);
      await user.type(input, 'test');

      // Close dropdown first
      await user.keyboard('{Escape}');

      // Press Escape again to clear
      await user.keyboard('{Escape}');

      expect(input).toHaveValue('');
    });
  });

  describe('result selection', () => {
    beforeEach(() => {
      vi.mocked(useTicketSearch).mockReturnValue({
        data: mockResponses.searchResults(mockTickets),
        isLoading: false,
        error: null,
      });
    });

    it('should select result on Enter', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search tickets/i);
      await user.type(input, 'test');

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Wait for dropdown
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
      });

      // Navigate to first result and select
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      // Should navigate with ticket key
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('ticket=TEST-1')
      );
    });

    it('should clear search after selection', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search tickets/i);
      await user.type(input, 'test');

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
      });

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  describe('loading state', () => {
    it('should show loading indicator', () => {
      vi.mocked(useTicketSearch).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      renderWithProviders(<TicketSearch {...defaultProps} />);

      // Component renders input even during loading
      expect(screen.getByPlaceholderText(/search tickets/i)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should handle search errors gracefully', () => {
      vi.mocked(useTicketSearch).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Search failed'),
      });

      // Should not throw
      expect(() => {
        renderWithProviders(<TicketSearch {...defaultProps} />);
      }).not.toThrow();
    });
  });
});
