/**
 * RTL Component Tests: CommandAutocomplete
 *
 * Tests for the command autocomplete dropdown component.
 * Verifies dropdown rendering, selection, keyboard navigation, and empty states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { CommandAutocomplete } from '@/components/comments/command-autocomplete';
import { CommandPalette } from '@/components/search/command-palette';
import { CommandPaletteTrigger } from '@/components/search/command-palette-trigger';
import type { AIBoardCommand } from '@/app/lib/data/ai-board-commands';
import { useCommandPalette } from '@/lib/hooks/queries/use-command-palette';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/lib/hooks/queries/use-command-palette', () => ({
  useCommandPalette: vi.fn(() => ({
    data: {
      query: 'boa',
      groups: {
        destinations: [
          {
            id: 'destination:board',
            type: 'destination',
            label: 'Board',
            description: 'Project board',
            href: '/projects/1/board',
            matchScore: 900,
          },
        ],
        tickets: [
          {
            id: 'ticket:7',
            type: 'ticket',
            label: '[e2e] Palette ticket',
            description: 'E2E-7 • INBOX',
            href: '/projects/1/board?ticket=E2E-7&modal=open',
            ticketKey: 'E2E-7',
            stage: 'INBOX',
            matchType: 'prefix',
            matchScore: 700,
          },
        ],
      },
      totalCount: { destinations: 1, tickets: 1 },
    },
    isLoading: false,
    error: null,
  })),
}));

const mockUseCommandPalette = vi.mocked(useCommandPalette);

const mockCommands: AIBoardCommand[] = [
  { name: '/compare', description: 'Compare ticket implementations for best code quality' },
  { name: '/test', description: 'Run tests for the feature' },
];

describe('CommandAutocomplete', () => {
  const mockOnSelect = vi.fn();
  const defaultProps = {
    commands: mockCommands,
    onSelect: mockOnSelect,
    selectedIndex: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
    mockUseCommandPalette.mockReturnValue({
      data: {
        query: 'boa',
        groups: {
          destinations: [
            {
              id: 'destination:board',
              type: 'destination',
              label: 'Board',
              description: 'Project board',
              href: '/projects/1/board',
              matchScore: 900,
            },
          ],
          tickets: [
            {
              id: 'ticket:7',
              type: 'ticket',
              label: '[e2e] Palette ticket',
              description: 'E2E-7 • INBOX',
              href: '/projects/1/board?ticket=E2E-7&modal=open',
              ticketKey: 'E2E-7',
              stage: 'INBOX',
              matchType: 'prefix',
              matchScore: 700,
            },
          ],
        },
        totalCount: { destinations: 1, tickets: 1 },
      },
      isLoading: false,
      error: null,
    });
  });

  describe('Rendering', () => {
    it('should render command list with listbox role', () => {
      renderWithProviders(<CommandAutocomplete {...defaultProps} />);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should render all commands with option role', () => {
      renderWithProviders(<CommandAutocomplete {...defaultProps} />);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
    });

    it('should display command name', () => {
      renderWithProviders(<CommandAutocomplete {...defaultProps} />);

      expect(screen.getByText('/compare')).toBeInTheDocument();
      expect(screen.getByText('/test')).toBeInTheDocument();
    });

    it('should display command description', () => {
      renderWithProviders(<CommandAutocomplete {...defaultProps} />);

      expect(screen.getByText('Compare ticket implementations for best code quality')).toBeInTheDocument();
      expect(screen.getByText('Run tests for the feature')).toBeInTheDocument();
    });

    it('should have correct data-testid', () => {
      renderWithProviders(<CommandAutocomplete {...defaultProps} />);

      expect(screen.getByTestId('command-autocomplete')).toBeInTheDocument();
    });

    it('should mark selected command with data-selected', () => {
      renderWithProviders(<CommandAutocomplete {...defaultProps} selectedIndex={1} />);

      const selectedOption = screen.getAllByTestId('command-autocomplete-item')[1];
      expect(selectedOption).toHaveAttribute('data-selected', 'true');
    });

    it('should set aria-selected on selected command', () => {
      renderWithProviders(<CommandAutocomplete {...defaultProps} selectedIndex={1} />);

      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Empty State', () => {
    it('should display empty message when no commands', () => {
      renderWithProviders(<CommandAutocomplete {...defaultProps} commands={[]} />);

      expect(screen.getByText(/no commands available/i)).toBeInTheDocument();
    });

    it('should still render listbox when empty', () => {
      renderWithProviders(<CommandAutocomplete {...defaultProps} commands={[]} />);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('should call onSelect when command is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommandAutocomplete {...defaultProps} />);

      await user.click(screen.getAllByTestId('command-autocomplete-item')[0]);

      expect(mockOnSelect).toHaveBeenCalledWith(mockCommands[0]);
    });

    it('should call onSelect with correct command when second item clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommandAutocomplete {...defaultProps} />);

      await user.click(screen.getAllByTestId('command-autocomplete-item')[1]);

      expect(mockOnSelect).toHaveBeenCalledWith(mockCommands[1]);
    });

    it('should call onSelect only once per click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommandAutocomplete {...defaultProps} />);

      await user.click(screen.getAllByTestId('command-autocomplete-item')[0]);

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should highlight first item when selectedIndex is 0', () => {
      renderWithProviders(<CommandAutocomplete {...defaultProps} selectedIndex={0} />);

      const firstOption = screen.getAllByTestId('command-autocomplete-item')[0];
      expect(firstOption).toHaveAttribute('data-selected', 'true');
    });

    it('should highlight correct item based on selectedIndex', () => {
      renderWithProviders(<CommandAutocomplete {...defaultProps} selectedIndex={1} />);

      const secondOption = screen.getAllByTestId('command-autocomplete-item')[1];
      expect(secondOption).toHaveAttribute('data-selected', 'true');
    });

    it('should apply highlight styling to selected item', () => {
      renderWithProviders(<CommandAutocomplete {...defaultProps} selectedIndex={0} />);

      const selectedOption = screen.getAllByTestId('command-autocomplete-item')[0];
      expect(selectedOption).toHaveClass('bg-primary');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on listbox', () => {
      renderWithProviders(<CommandAutocomplete {...defaultProps} />);

      expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', 'Command autocomplete');
    });

    it('should use button elements for command items', () => {
      renderWithProviders(<CommandAutocomplete {...defaultProps} />);

      const buttons = screen.getAllByRole('option');
      buttons.forEach((button) => {
        expect(button.tagName.toLowerCase()).toBe('button');
      });
    });
  });

  describe('Command Palette', () => {
    it('renders the command palette trigger affordance', () => {
      renderWithProviders(<CommandPaletteTrigger onClick={vi.fn()} />);

      expect(screen.getByTestId('command-palette-trigger')).toBeInTheDocument();
    });

    it('renders grouped destination and ticket results', () => {
      renderWithProviders(
        <CommandPalette projectId={1} open onOpenChange={vi.fn()} />
      );

      expect(screen.getByText('Destinations')).toBeInTheDocument();
      expect(screen.getByText('Tickets')).toBeInTheDocument();
      expect(screen.getByText('Board')).toBeInTheDocument();
      expect(screen.getByText('[e2e] Palette ticket')).toBeInTheDocument();
    });

    it('navigates with keyboard selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CommandPalette projectId={1} open onOpenChange={vi.fn()} />
      );

      const input = screen.getByLabelText(/search destinations and tickets/i);
      await user.type(input, '{ArrowDown}{Enter}');

      expect(mockPush).toHaveBeenCalledWith(
        '/projects/1/board?ticket=E2E-7&modal=open'
      );
    });
  });
});
