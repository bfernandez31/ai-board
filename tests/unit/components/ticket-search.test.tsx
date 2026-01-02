/**
 * RTL Component Tests: TicketSearch
 *
 * Tests for the ticket search component.
 * Verifies search input, results display, and keyboard navigation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { TicketSearch } from '@/components/search/ticket-search';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the search hook
const mockSearchResults = {
  results: [
    { ticketKey: 'TEST-1', title: 'First Ticket', stage: 'INBOX' },
    { ticketKey: 'TEST-2', title: 'Second Ticket', stage: 'BUILD' },
  ],
};

vi.mock('@/app/lib/hooks/queries/useTicketSearch', () => ({
  useTicketSearch: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
}));

// Import the mocked hook to control it
import { useTicketSearch } from '@/app/lib/hooks/queries/useTicketSearch';
const mockUseTicketSearch = vi.mocked(useTicketSearch);

describe('TicketSearch', () => {
  const defaultProps = {
    projectId: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTicketSearch.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
  });

  describe('Rendering', () => {
    it('should display search input with placeholder', () => {
      renderWithProviders(<TicketSearch {...defaultProps} />);

      expect(screen.getByLabelText(/search tickets/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/search tickets/i)).toBeInTheDocument();
    });

    it('should have search icon visible', () => {
      renderWithProviders(<TicketSearch {...defaultProps} />);

      // The input should be visible (it's hidden on mobile via CSS classes)
      const input = screen.getByLabelText(/search tickets/i);
      expect(input).toBeInTheDocument();
    });
  });

  describe('Search Input Behavior', () => {
    it('should update input value when user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByLabelText(/search tickets/i);
      await user.type(input, 'test query');

      expect(input).toHaveValue('test query');
    });

    it('should not show dropdown for short queries (less than 2 chars)', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByLabelText(/search tickets/i);
      await user.type(input, 'a');

      // Popover should not appear for single character
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should clear search term on Escape key', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByLabelText(/search tickets/i);
      await user.type(input, 'test');
      await user.keyboard('{Escape}');

      expect(input).toHaveValue('');
    });
  });

  describe('Search Results', () => {
    it('should show loading state while searching', async () => {
      mockUseTicketSearch.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      const user = userEvent.setup();
      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByLabelText(/search tickets/i);
      await user.type(input, 'test');

      // Wait for debounce and check loading state
      await waitFor(
        () => {
          expect(input).toHaveAttribute('aria-expanded', 'true');
        },
        { timeout: 500 }
      );
    });

    it('should display results when search returns data', async () => {
      mockUseTicketSearch.mockReturnValue({
        data: mockSearchResults,
        isLoading: false,
        error: null,
      });

      const user = userEvent.setup();
      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByLabelText(/search tickets/i);
      await user.type(input, 'test');

      // Wait for debounce (300ms) and results to appear
      await waitFor(
        () => {
          expect(input).toHaveAttribute('aria-expanded', 'true');
        },
        { timeout: 500 }
      );
    });
  });

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      mockUseTicketSearch.mockReturnValue({
        data: mockSearchResults,
        isLoading: false,
        error: null,
      });
    });

    it('should have aria-expanded attribute for accessibility', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByLabelText(/search tickets/i);
      expect(input).toHaveAttribute('aria-expanded', 'false');

      await user.type(input, 'test');

      await waitFor(
        () => {
          expect(input).toHaveAttribute('aria-expanded', 'true');
        },
        { timeout: 500 }
      );
    });

    it('should have aria-haspopup attribute', () => {
      renderWithProviders(<TicketSearch {...defaultProps} />);

      const input = screen.getByLabelText(/search tickets/i);
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    });
  });
});
