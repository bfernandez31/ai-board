/**
 * MentionInput Component Integration Tests
 *
 * Tests @ trigger behavior, user filtering, and mention selection using
 * React Testing Library.
 *
 * @see specs/AIB-117-testing-trophy-component/contracts/component-test-patterns.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '@/tests/helpers/render-with-providers';
import { MentionInput } from '@/components/comments/mention-input';
import { mockProjectMembers } from '@/tests/fixtures/component-mocks';

// Mock the AI-BOARD availability hook
vi.mock('@/app/hooks/use-ai-board-availability', () => ({
  useAIBoardAvailability: vi.fn(() => ({
    data: { available: true, reason: null },
  })),
}));

describe('MentionInput', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    projectMembers: mockProjectMembers,
    placeholder: 'Write a comment...',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic rendering', () => {
    it('should render textarea with placeholder', () => {
      renderWithProviders(<MentionInput {...defaultProps} />);

      expect(screen.getByPlaceholderText(/write a comment/i)).toBeInTheDocument();
    });

    it('should display provided value', () => {
      renderWithProviders(<MentionInput {...defaultProps} value="Hello world" />);

      expect(screen.getByRole('textbox')).toHaveValue('Hello world');
    });

    it('should be disabled when disabled prop is true', () => {
      renderWithProviders(<MentionInput {...defaultProps} disabled />);

      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });

  describe('@ trigger behavior', () => {
    it('should show autocomplete when @ is typed at word boundary', async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <MentionInput {...defaultProps} onChange={onChange} />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');

      await waitFor(() => {
        expect(screen.getByTestId('mention-autocomplete')).toBeInTheDocument();
      });
    });

    it('should show autocomplete when @ is typed after space', async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <MentionInput {...defaultProps} value="Hello " onChange={onChange} />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');

      await waitFor(() => {
        expect(screen.getByTestId('mention-autocomplete')).toBeInTheDocument();
      });
    });

    it('should NOT show autocomplete when @ is in the middle of a word', async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <MentionInput {...defaultProps} value="email" onChange={onChange} />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');

      // Autocomplete should NOT appear
      expect(screen.queryByTestId('mention-autocomplete')).not.toBeInTheDocument();
    });

    it('should notify parent when autocomplete opens', async () => {
      const onAutocompleteOpenChange = vi.fn();
      const { user } = renderWithProviders(
        <MentionInput
          {...defaultProps}
          onAutocompleteOpenChange={onAutocompleteOpenChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');

      await waitFor(() => {
        expect(onAutocompleteOpenChange).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('user filtering', () => {
    it('should show all users when @ is typed without query', async () => {
      const { user } = renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');

      await waitFor(() => {
        const autocomplete = screen.getByTestId('mention-autocomplete');
        expect(within(autocomplete).getByText(/project owner/i)).toBeInTheDocument();
        expect(within(autocomplete).getByText(/john doe/i)).toBeInTheDocument();
        expect(within(autocomplete).getByText(/jane smith/i)).toBeInTheDocument();
      });
    });

    it('should filter users by name', async () => {
      const { user } = renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@jo');

      await waitFor(() => {
        const autocomplete = screen.getByTestId('mention-autocomplete');
        expect(within(autocomplete).getByText(/john doe/i)).toBeInTheDocument();
        expect(within(autocomplete).queryByText(/jane smith/i)).not.toBeInTheDocument();
      });
    });

    it('should filter users by email', async () => {
      const { user } = renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@jane@');

      await waitFor(() => {
        const autocomplete = screen.getByTestId('mention-autocomplete');
        expect(within(autocomplete).getByText(/jane smith/i)).toBeInTheDocument();
        expect(within(autocomplete).queryByText(/john doe/i)).not.toBeInTheDocument();
      });
    });

    it('should be case insensitive', async () => {
      const { user } = renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@JOHN');

      await waitFor(() => {
        const autocomplete = screen.getByTestId('mention-autocomplete');
        expect(within(autocomplete).getByText(/john doe/i)).toBeInTheDocument();
      });
    });
  });

  describe('keyboard navigation', () => {
    it('should navigate down with ArrowDown', async () => {
      const { user } = renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');

      await waitFor(() => {
        expect(screen.getByTestId('mention-autocomplete')).toBeInTheDocument();
      });

      await user.keyboard('{ArrowDown}');

      // First item should be selected
      await waitFor(() => {
        const selectedItem = screen.getByTestId('mention-user-item');
        expect(selectedItem).toHaveAttribute('data-selected', 'true');
      });
    });

    it('should navigate up with ArrowUp', async () => {
      const { user } = renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');

      await waitFor(() => {
        expect(screen.getByTestId('mention-autocomplete')).toBeInTheDocument();
      });

      // Navigate down twice then up
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowUp}');

      // First item should be selected again
      const items = screen.getAllByTestId('mention-user-item');
      expect(items[0]).toHaveAttribute('data-selected', 'true');
    });

    it('should close autocomplete on Escape', async () => {
      const { user } = renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');

      await waitFor(() => {
        expect(screen.getByTestId('mention-autocomplete')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('mention-autocomplete')).not.toBeInTheDocument();
      });
    });
  });

  describe('mention selection', () => {
    it('should insert mention on Enter', async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <MentionInput {...defaultProps} onChange={onChange} />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@jo');

      await waitFor(() => {
        expect(screen.getByTestId('mention-autocomplete')).toBeInTheDocument();
      });

      // Select first matching result with Enter
      await user.keyboard('{Enter}');

      // Should call onChange with formatted mention
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('@['));
      });
    });

    it('should insert mention on click', async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <MentionInput {...defaultProps} onChange={onChange} />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');

      await waitFor(() => {
        expect(screen.getByTestId('mention-autocomplete')).toBeInTheDocument();
      });

      // Click on a user
      const johnItem = screen.getByText(/john doe/i);
      await user.click(johnItem);

      // Should call onChange with formatted mention
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('@['));
      });
    });

    it('should close autocomplete after selection', async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <MentionInput {...defaultProps} onChange={onChange} />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@jo');

      await waitFor(() => {
        expect(screen.getByTestId('mention-autocomplete')).toBeInTheDocument();
      });

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.queryByTestId('mention-autocomplete')).not.toBeInTheDocument();
      });
    });

    it('should add space after inserted mention', async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <MentionInput {...defaultProps} onChange={onChange} />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@jo');

      await waitFor(() => {
        expect(screen.getByTestId('mention-autocomplete')).toBeInTheDocument();
      });

      await user.keyboard('{Enter}');

      await waitFor(() => {
        // The onChange should include a space after the mention
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[0]).toMatch(/@\[.*\] $/);
      });
    });
  });

  describe('multiple mentions', () => {
    it('should allow typing text after a mention', async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <MentionInput
          {...defaultProps}
          value="@[2:John Doe] "
          onChange={onChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'can you help?');

      expect(onChange).toHaveBeenCalled();
    });

    it('should allow multiple mentions in same message', async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <MentionInput
          {...defaultProps}
          value="@[2:John Doe] and "
          onChange={onChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');

      await waitFor(() => {
        expect(screen.getByTestId('mention-autocomplete')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have accessible textarea', () => {
      renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('should maintain focus on textarea after selection', async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <MentionInput {...defaultProps} onChange={onChange} />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@jo');

      await waitFor(() => {
        expect(screen.getByTestId('mention-autocomplete')).toBeInTheDocument();
      });

      await user.keyboard('{Enter}');

      // Focus should return to textarea
      await waitFor(() => {
        expect(textarea).toHaveFocus();
      });
    });
  });
});
