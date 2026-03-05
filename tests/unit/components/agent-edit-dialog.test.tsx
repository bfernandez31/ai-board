/**
 * RTL Component Tests: AgentEditDialog
 *
 * Tests for the agent edit dialog component.
 * Verifies rendering, current status display, and button states.
 * Note: Radix Select interaction is limited in happy-dom; tested via integration tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
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

      expect(screen.getByRole('heading', { name: /edit ai agent/i })).toBeInTheDocument();
      expect(screen.getByText(/choose an agent for this ticket/i)).toBeInTheDocument();
    });

    it('should show current agent status section', () => {
      renderWithProviders(<AgentEditDialog {...defaultProps} />);

      expect(screen.getByText('Current Agent')).toBeInTheDocument();
    });

    it('should show project default indicator when no override', () => {
      renderWithProviders(<AgentEditDialog {...defaultProps} />);

      // The current agent section should show "(project default)"
      const statusSection = screen.getByText('Current Agent').closest('div');
      expect(statusSection?.textContent).toContain('project default');
      expect(statusSection?.textContent).toContain('Claude');
    });

    it('should show override indicator when agent is explicitly set', () => {
      renderWithProviders(
        <AgentEditDialog {...defaultProps} currentAgent={Agent.CODEX} />
      );

      const statusSection = screen.getByText('Current Agent').closest('div');
      expect(statusSection?.textContent).toContain('override');
      expect(statusSection?.textContent).toContain('Codex');
    });

    it('should render agent select with combobox role', () => {
      renderWithProviders(<AgentEditDialog {...defaultProps} />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    it('should disable Save button when no changes made', () => {
      renderWithProviders(<AgentEditDialog {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toBeDisabled();
    });

    it('should render Cancel button', () => {
      renderWithProviders(<AgentEditDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
      expect(cancelButton).not.toBeDisabled();
    });

    it('should call onOpenChange when Cancel is clicked', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      const user = userEvent.setup();
      renderWithProviders(<AgentEditDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Not Rendered', () => {
    it('should not render dialog content when closed', () => {
      renderWithProviders(<AgentEditDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('Edit AI Agent')).not.toBeInTheDocument();
    });
  });
});
