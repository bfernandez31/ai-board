/**
 * RTL Component Tests: SearchResults
 *
 * Tests for the search results dropdown component.
 * Verifies contrast styling for closed tickets meets WCAG AA requirements.
 *
 * Feature: AIB-150 - Contrast on Search Closed Ticket
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { SearchResults } from '@/components/search/search-results';
import type { SearchResult } from '@/app/lib/types/search';

describe('SearchResults', () => {
  const mockOnSelect = vi.fn();

  const openTicket: SearchResult = {
    id: 1,
    ticketKey: 'TEST-1',
    title: 'Open Ticket',
    stage: 'INBOX',
  };

  const closedTicket: SearchResult = {
    id: 2,
    ticketKey: 'TEST-2',
    title: 'Closed Ticket',
    stage: 'CLOSED',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading and Error States', () => {
    it('should display loading state', () => {
      renderWithProviders(
        <SearchResults
          results={[]}
          selectedIndex={-1}
          onSelect={mockOnSelect}
          isLoading={true}
        />
      );

      expect(screen.getByText('Searching...')).toBeInTheDocument();
    });

    it('should display error state', () => {
      renderWithProviders(
        <SearchResults
          results={[]}
          selectedIndex={-1}
          onSelect={mockOnSelect}
          error={new Error('Network error')}
        />
      );

      expect(screen.getByText('Search unavailable')).toBeInTheDocument();
    });

    it('should display empty state', () => {
      renderWithProviders(
        <SearchResults
          results={[]}
          selectedIndex={-1}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('No tickets found')).toBeInTheDocument();
    });
  });

  describe('Results Display', () => {
    it('should display ticket key and title', () => {
      renderWithProviders(
        <SearchResults
          results={[openTicket]}
          selectedIndex={-1}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('TEST-1')).toBeInTheDocument();
      expect(screen.getByText('Open Ticket')).toBeInTheDocument();
    });

    it('should display closed badge for closed tickets', () => {
      renderWithProviders(
        <SearchResults
          results={[closedTicket]}
          selectedIndex={-1}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Closed')).toBeInTheDocument();
    });

    it('should not display closed badge for open tickets', () => {
      renderWithProviders(
        <SearchResults
          results={[openTicket]}
          selectedIndex={-1}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.queryByText('Closed')).not.toBeInTheDocument();
    });
  });

  describe('Selection and Click Handling', () => {
    it('should call onSelect when clicking a result', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <SearchResults
          results={[openTicket, closedTicket]}
          selectedIndex={-1}
          onSelect={mockOnSelect}
        />
      );

      await user.click(screen.getByRole('option', { name: /TEST-1/i }));
      expect(mockOnSelect).toHaveBeenCalledWith(openTicket);
    });

    it('should call onSelect when clicking a closed ticket', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <SearchResults
          results={[closedTicket]}
          selectedIndex={-1}
          onSelect={mockOnSelect}
        />
      );

      await user.click(screen.getByRole('option', { name: /TEST-2/i }));
      expect(mockOnSelect).toHaveBeenCalledWith(closedTicket);
    });

    it('should mark selected item with aria-selected', () => {
      renderWithProviders(
        <SearchResults
          results={[openTicket, closedTicket]}
          selectedIndex={1}
          onSelect={mockOnSelect}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'false');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Closed Ticket Styling - Default State', () => {
    it('should apply opacity-60 to non-selected closed tickets', () => {
      renderWithProviders(
        <SearchResults
          results={[closedTicket]}
          selectedIndex={-1}
          onSelect={mockOnSelect}
        />
      );

      const button = screen.getByRole('option');
      expect(button.className).toContain('opacity-60');
    });

    it('should not apply opacity-60 to non-selected open tickets', () => {
      renderWithProviders(
        <SearchResults
          results={[openTicket]}
          selectedIndex={-1}
          onSelect={mockOnSelect}
        />
      );

      const button = screen.getByRole('option');
      expect(button.className).not.toContain('opacity-60');
    });
  });

  describe('Closed Ticket Styling - Selected State (WCAG AA Contrast)', () => {
    it('should NOT apply opacity-60 to selected closed tickets', () => {
      renderWithProviders(
        <SearchResults
          results={[closedTicket]}
          selectedIndex={0}
          onSelect={mockOnSelect}
        />
      );

      const button = screen.getByRole('option');
      // Selected closed tickets should NOT have opacity-60 (contrast fix)
      expect(button.className).not.toContain('opacity-60');
    });

    it('should apply bg-muted to selected closed tickets instead of bg-primary', () => {
      renderWithProviders(
        <SearchResults
          results={[closedTicket]}
          selectedIndex={0}
          onSelect={mockOnSelect}
        />
      );

      const button = screen.getByRole('option');
      expect(button.className).toContain('bg-muted');
      expect(button.className).not.toContain('bg-primary');
    });

    it('should apply text-foreground to selected closed tickets', () => {
      renderWithProviders(
        <SearchResults
          results={[closedTicket]}
          selectedIndex={0}
          onSelect={mockOnSelect}
        />
      );

      const button = screen.getByRole('option');
      expect(button.className).toContain('text-foreground');
    });
  });

  describe('Open Ticket Styling - Selected State', () => {
    it('should apply bg-primary to selected open tickets', () => {
      renderWithProviders(
        <SearchResults
          results={[openTicket]}
          selectedIndex={0}
          onSelect={mockOnSelect}
        />
      );

      const button = screen.getByRole('option');
      expect(button.className).toContain('bg-primary');
    });

    it('should apply text-primary-foreground to selected open tickets', () => {
      renderWithProviders(
        <SearchResults
          results={[openTicket]}
          selectedIndex={0}
          onSelect={mockOnSelect}
        />
      );

      const button = screen.getByRole('option');
      expect(button.className).toContain('text-primary-foreground');
    });
  });

  describe('Mixed Results - Styling Differentiation', () => {
    it('should differentiate styling between selected open and non-selected closed tickets', () => {
      renderWithProviders(
        <SearchResults
          results={[openTicket, closedTicket]}
          selectedIndex={0}
          onSelect={mockOnSelect}
        />
      );

      const options = screen.getAllByRole('option');
      // First (selected open) should have bg-primary
      expect(options[0].className).toContain('bg-primary');
      // Second (non-selected closed) should have opacity-60
      expect(options[1].className).toContain('opacity-60');
    });

    it('should differentiate styling between non-selected open and selected closed tickets', () => {
      renderWithProviders(
        <SearchResults
          results={[openTicket, closedTicket]}
          selectedIndex={1}
          onSelect={mockOnSelect}
        />
      );

      const options = screen.getAllByRole('option');
      // First (non-selected open) should not have special styling
      expect(options[0].className).not.toContain('bg-primary');
      expect(options[0].className).not.toContain('opacity-60');
      // Second (selected closed) should have bg-muted, no opacity-60
      expect(options[1].className).toContain('bg-muted');
      expect(options[1].className).not.toContain('opacity-60');
    });
  });

  describe('Accessibility', () => {
    it('should have listbox role on container', () => {
      renderWithProviders(
        <SearchResults
          results={[openTicket]}
          selectedIndex={-1}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should have option role on each result', () => {
      renderWithProviders(
        <SearchResults
          results={[openTicket, closedTicket]}
          selectedIndex={-1}
          onSelect={mockOnSelect}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
    });

    it('should have data-selected attribute for CSS styling hooks', () => {
      renderWithProviders(
        <SearchResults
          results={[openTicket, closedTicket]}
          selectedIndex={0}
          onSelect={mockOnSelect}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('data-selected', 'true');
      expect(options[1]).toHaveAttribute('data-selected', 'false');
    });
  });
});
