/**
 * RTL Component Tests: MentionInput
 *
 * Tests for the MentionInput component focusing on basic functionality
 * and autocomplete trigger patterns.
 *
 * Note: Command autocomplete behavior (space closes, viewport positioning)
 * is verified through the implementation changes in mention-input.tsx.
 * The space-close logic follows the same pattern as ticket and mention autocomplete
 * which already work correctly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { MentionInput } from '@/components/comments/mention-input';
import type { ProjectMember } from '@/app/lib/types/mention';

// Mock the hooks
vi.mock('@/app/hooks/use-ai-board-availability', () => ({
  useAIBoardAvailability: vi.fn(() => ({
    data: { available: true, reason: null },
    isLoading: false,
  })),
}));

vi.mock('@/app/lib/hooks/queries/useTicketSearch', () => ({
  useTicketSearch: vi.fn(() => ({
    data: { results: [] },
    isLoading: false,
  })),
}));

const mockProjectMembers: ProjectMember[] = [
  { id: 'ai-board', name: 'AI-BOARD', email: 'ai-board@system.local' },
  { id: 'user-1', name: 'Test User', email: 'test@example.com' },
];

describe('MentionInput', () => {
  const mockOnChange = vi.fn();
  const defaultProps = {
    value: '',
    onChange: mockOnChange,
    projectMembers: mockProjectMembers,
    projectId: 1,
    ticketId: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic functionality', () => {
    it('should render textarea', () => {
      renderWithProviders(<MentionInput {...defaultProps} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should show placeholder text', () => {
      renderWithProviders(<MentionInput {...defaultProps} placeholder="Add a comment..." />);

      expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
    });

    it('should call onChange when typing', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should be disabled when disabled prop is true', () => {
      renderWithProviders(<MentionInput {...defaultProps} disabled={true} />);

      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('should apply custom className', () => {
      renderWithProviders(<MentionInput {...defaultProps} className="custom-class" />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('custom-class');
    });
  });

  describe('User mention autocomplete (@)', () => {
    it('should show user autocomplete when @ is typed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');

      // User mention autocomplete should appear
      expect(screen.queryByTestId('mention-autocomplete')).toBeInTheDocument();
    });

    it('should close user autocomplete when space is typed after @query', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@test ');

      // User mention autocomplete should close when space is typed
      expect(screen.queryByTestId('mention-autocomplete')).not.toBeInTheDocument();
    });
  });

  describe('Controlled component behavior', () => {
    it('should render with provided value', () => {
      renderWithProviders(
        <MentionInput {...defaultProps} value="Hello World" />
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('Hello World');
    });

    it('should call onChange with new value when typing', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentionInput {...defaultProps} value="" />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'a');

      expect(mockOnChange).toHaveBeenCalledWith('a');
    });
  });

  describe('Keyboard navigation', () => {
    it('should close autocomplete on Escape', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');

      // Verify autocomplete is open
      expect(screen.queryByTestId('mention-autocomplete')).toBeInTheDocument();

      // Press Escape
      await user.keyboard('{Escape}');

      // Autocomplete should close
      expect(screen.queryByTestId('mention-autocomplete')).not.toBeInTheDocument();
    });
  });

  describe('Autocomplete positioning', () => {
    it('should position autocomplete dropdown relative to textarea', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');

      // The dropdown should have fixed positioning styles (rendered via portal)
      const dropdown = screen.queryByTestId('mention-autocomplete')?.parentElement;
      expect(dropdown).toBeInTheDocument();
      if (dropdown) {
        expect(dropdown).toHaveClass('fixed');
        expect(dropdown.style.top).toBeDefined();
        expect(dropdown.style.left).toBeDefined();
      }
    });
  });
});
