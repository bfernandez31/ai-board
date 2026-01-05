/**
 * RTL Component Tests: TicketAutocomplete
 *
 * Tests for the ticket autocomplete dropdown component.
 * Verifies dropdown rendering, selection, keyboard navigation, and empty states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { TicketAutocomplete } from '@/components/comments/ticket-autocomplete';
import type { SearchResult } from '@/app/lib/types/search';
import { Stage } from '@prisma/client';

const mockTickets: SearchResult[] = [
  { id: 1, ticketKey: 'AIB-120', title: 'First ticket', stage: Stage.BUILD },
  { id: 2, ticketKey: 'AIB-121', title: 'Second ticket', stage: Stage.VERIFY },
  { id: 3, ticketKey: 'AIB-122', title: 'Third ticket', stage: Stage.INBOX },
];

describe('TicketAutocomplete', () => {
  const mockOnSelect = vi.fn();
  const defaultProps = {
    tickets: mockTickets,
    onSelect: mockOnSelect,
    selectedIndex: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render ticket list with listbox role', () => {
      renderWithProviders(<TicketAutocomplete {...defaultProps} />);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should render all tickets with option role', () => {
      renderWithProviders(<TicketAutocomplete {...defaultProps} />);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
    });

    it('should display ticket key and title', () => {
      renderWithProviders(<TicketAutocomplete {...defaultProps} />);

      expect(screen.getByText('AIB-120')).toBeInTheDocument();
      expect(screen.getByText('First ticket')).toBeInTheDocument();
    });

    it('should display stage badge for each ticket', () => {
      renderWithProviders(<TicketAutocomplete {...defaultProps} />);

      expect(screen.getByText('BUILD')).toBeInTheDocument();
      expect(screen.getByText('VERIFY')).toBeInTheDocument();
      expect(screen.getByText('INBOX')).toBeInTheDocument();
    });

    it('should have correct data-testid', () => {
      renderWithProviders(<TicketAutocomplete {...defaultProps} />);

      expect(screen.getByTestId('ticket-autocomplete')).toBeInTheDocument();
    });

    it('should mark selected ticket with data-selected', () => {
      renderWithProviders(<TicketAutocomplete {...defaultProps} selectedIndex={1} />);

      const selectedOption = screen.getAllByTestId('ticket-autocomplete-item')[1];
      expect(selectedOption).toHaveAttribute('data-selected', 'true');
    });

    it('should set aria-selected on selected ticket', () => {
      renderWithProviders(<TicketAutocomplete {...defaultProps} selectedIndex={1} />);

      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Empty State', () => {
    it('should display empty message when no tickets', () => {
      renderWithProviders(<TicketAutocomplete {...defaultProps} tickets={[]} />);

      expect(screen.getByText(/no tickets found/i)).toBeInTheDocument();
    });

    it('should still render listbox when empty', () => {
      renderWithProviders(<TicketAutocomplete {...defaultProps} tickets={[]} />);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('should call onSelect when ticket is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TicketAutocomplete {...defaultProps} />);

      await user.click(screen.getAllByTestId('ticket-autocomplete-item')[0]);

      expect(mockOnSelect).toHaveBeenCalledWith(mockTickets[0]);
    });

    it('should call onSelect with correct ticket when second item clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TicketAutocomplete {...defaultProps} />);

      await user.click(screen.getAllByTestId('ticket-autocomplete-item')[1]);

      expect(mockOnSelect).toHaveBeenCalledWith(mockTickets[1]);
    });

    it('should call onSelect only once per click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TicketAutocomplete {...defaultProps} />);

      await user.click(screen.getAllByTestId('ticket-autocomplete-item')[0]);

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should highlight first item when selectedIndex is 0', () => {
      renderWithProviders(<TicketAutocomplete {...defaultProps} selectedIndex={0} />);

      const firstOption = screen.getAllByTestId('ticket-autocomplete-item')[0];
      expect(firstOption).toHaveAttribute('data-selected', 'true');
    });

    it('should highlight correct item based on selectedIndex', () => {
      renderWithProviders(<TicketAutocomplete {...defaultProps} selectedIndex={2} />);

      const thirdOption = screen.getAllByTestId('ticket-autocomplete-item')[2];
      expect(thirdOption).toHaveAttribute('data-selected', 'true');
    });

    it('should apply highlight styling to selected item', () => {
      renderWithProviders(<TicketAutocomplete {...defaultProps} selectedIndex={0} />);

      const selectedOption = screen.getAllByTestId('ticket-autocomplete-item')[0];
      expect(selectedOption).toHaveClass('bg-primary');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on listbox', () => {
      renderWithProviders(<TicketAutocomplete {...defaultProps} />);

      expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', 'Ticket autocomplete');
    });

    it('should use button elements for ticket items', () => {
      renderWithProviders(<TicketAutocomplete {...defaultProps} />);

      const buttons = screen.getAllByRole('option');
      buttons.forEach((button) => {
        expect(button.tagName.toLowerCase()).toBe('button');
      });
    });
  });
});
