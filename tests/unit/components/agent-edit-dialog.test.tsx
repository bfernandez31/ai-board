import { describe, it, expect, vi, beforeEach } from 'vitest';
import { within } from '@testing-library/react';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { AgentEditDialog } from '@/components/tickets/agent-edit-dialog';
import { Agent } from '@prisma/client';

describe('AgentEditDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    currentAgent: null as Agent | null,
    projectDefaultAgent: Agent.CLAUDE,
    onSave: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should display dialog title and description', () => {
      renderWithProviders(<AgentEditDialog {...defaultProps} />);

      expect(screen.getByText('Edit Agent')).toBeInTheDocument();
    });

    it('should show current agent info section', () => {
      renderWithProviders(<AgentEditDialog {...defaultProps} currentAgent={null} />);

      const currentSection = screen.getByText('Current Agent').closest('div')!;
      expect(within(currentSection).getByText(/Claude/)).toBeInTheDocument();
    });

    it('should show override indicator when agent is set', () => {
      renderWithProviders(<AgentEditDialog {...defaultProps} currentAgent={Agent.CODEX} />);

      const currentSection = screen.getByText('Current Agent').closest('div')!;
      expect(within(currentSection).getByText(/Codex/)).toBeInTheDocument();
    });

    it('should have save button disabled when no changes', () => {
      renderWithProviders(<AgentEditDialog {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('User Interactions', () => {
    it('should call onOpenChange when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AgentEditDialog {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
