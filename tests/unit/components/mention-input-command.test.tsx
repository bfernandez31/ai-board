/**
 * RTL Component Tests: MentionInput - Command Autocomplete
 *
 * Tests for command autocomplete behavior in the mention input component.
 * Verifies that command autocomplete stops after selection or space.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { MentionInput } from '@/components/comments/mention-input';
import { fireEvent } from '@testing-library/react';
import type { ProjectMember } from '@/app/lib/types/mention';

const mockProjectMembers: ProjectMember[] = [
  { id: 1, name: 'Test User', email: 'test@example.com' },
  { id: 2, name: 'AI-BOARD', email: 'ai-board@system.local' },
];

describe('MentionInput - Command Autocomplete', () => {
  const mockOnChange = vi.fn();
  const mockOnAutocompleteOpenChange = vi.fn();
  let currentValue = '';

  const defaultProps = {
    value: currentValue,
    onChange: (value: string) => {
      currentValue = value;
      mockOnChange(value);
    },
    projectMembers: mockProjectMembers,
    projectId: 1,
    onAutocompleteOpenChange: mockOnAutocompleteOpenChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    currentValue = '';
  });

  describe('Command Autocomplete Triggering', () => {
    it('should show command autocomplete after typing / following @ai-board mention', async () => {
      const { rerender } = renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Simulate typing @ai-board mention with /
      const mentionText = '@[2:AI-BOARD] /';
      fireEvent.change(textarea, { target: { value: mentionText, selectionStart: mentionText.length } });
      currentValue = mentionText;
      rerender(<MentionInput {...defaultProps} value={currentValue} />);

      // Command autocomplete should be shown
      await waitFor(() => {
        expect(screen.queryByTestId('command-autocomplete')).toBeInTheDocument();
      });
    });

    it('should NOT show command autocomplete after typing space after /', async () => {
      const { rerender } = renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Simulate typing @ai-board mention with / followed by space
      const mentionText = '@[2:AI-BOARD] /compare ';
      fireEvent.change(textarea, { target: { value: mentionText, selectionStart: mentionText.length } });
      currentValue = mentionText;
      rerender(<MentionInput {...defaultProps} value={currentValue} />);

      // Command autocomplete should NOT be shown
      await waitFor(() => {
        expect(screen.queryByTestId('command-autocomplete')).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('should NOT show command autocomplete after selecting a command', async () => {
      const { rerender } = renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // First, type to show autocomplete
      let mentionText = '@[2:AI-BOARD] /comp';
      fireEvent.change(textarea, { target: { value: mentionText, selectionStart: mentionText.length } });
      currentValue = mentionText;
      rerender(<MentionInput {...defaultProps} value={currentValue} />);

      // Wait for autocomplete to appear
      await waitFor(() => {
        expect(screen.queryByTestId('command-autocomplete')).toBeInTheDocument();
      });

      // Simulate command selection (which adds a space)
      mentionText = '@[2:AI-BOARD] /compare ';
      fireEvent.change(textarea, { target: { value: mentionText, selectionStart: mentionText.length } });
      currentValue = mentionText;
      rerender(<MentionInput {...defaultProps} value={currentValue} />);

      // Autocomplete should close after selection
      await waitFor(() => {
        expect(screen.queryByTestId('command-autocomplete')).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('should close command autocomplete when space is typed', async () => {
      const { rerender } = renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // First, show autocomplete
      let mentionText = '@[2:AI-BOARD] /comp';
      fireEvent.change(textarea, { target: { value: mentionText, selectionStart: mentionText.length } });
      currentValue = mentionText;
      rerender(<MentionInput {...defaultProps} value={currentValue} />);

      // Wait for autocomplete to appear
      await waitFor(() => {
        expect(screen.queryByTestId('command-autocomplete')).toBeInTheDocument();
      });

      // Type space to close it
      mentionText = '@[2:AI-BOARD] /comp ';
      fireEvent.change(textarea, { target: { value: mentionText, selectionStart: mentionText.length } });
      currentValue = mentionText;
      rerender(<MentionInput {...defaultProps} value={currentValue} />);

      // Autocomplete should close
      await waitFor(() => {
        expect(screen.queryByTestId('command-autocomplete')).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('Space Detection', () => {
    it('should not trigger autocomplete with space in query', async () => {
      const { rerender } = renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Simulate typing with space after command
      const mentionText = '@[2:AI-BOARD] /compare description';
      fireEvent.change(textarea, { target: { value: mentionText, selectionStart: mentionText.length } });
      currentValue = mentionText;
      rerender(<MentionInput {...defaultProps} value={currentValue} />);

      // Command autocomplete should NOT be shown
      await waitFor(() => {
        expect(screen.queryByTestId('command-autocomplete')).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('should not trigger autocomplete when typing after completed command', async () => {
      const { rerender } = renderWithProviders(<MentionInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Start with completed command
      const mentionText = '@[2:AI-BOARD] /compare some additional text';
      fireEvent.change(textarea, { target: { value: mentionText, selectionStart: mentionText.length } });
      currentValue = mentionText;
      rerender(<MentionInput {...defaultProps} value={currentValue} />);

      // Command autocomplete should NOT be shown
      await waitFor(() => {
        expect(screen.queryByTestId('command-autocomplete')).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });
});
