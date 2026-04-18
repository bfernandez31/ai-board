/**
 * RTL Component Tests: ClaudeModelsEditDialog
 *
 * Verifies rendering branches for Claude vs non-Claude and the reset button.
 * Radix Select interaction is limited in happy-dom; full selection flow is
 * covered by integration tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ClaudeModelsEditDialog } from '@/components/tickets/claude-models-edit-dialog';
import { Agent } from '@prisma/client';

describe('ClaudeModelsEditDialog', () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    effectiveAgent: Agent.CLAUDE,
    projectClaudeModels: {
      specify: 'claude-opus-4-7',
      plan: 'claude-opus-4-7',
      implement: 'claude-sonnet-4-6',
    },
    ticketClaudeModelOverrides: null as unknown,
    onSave: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders five stage rows when effective agent is Claude', () => {
    renderWithProviders(<ClaudeModelsEditDialog {...baseProps} />);

    expect(screen.getByTestId('claude-models-edit-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('claude-models-dialog-row-specify')).toBeInTheDocument();
    expect(screen.getByTestId('claude-models-dialog-row-plan')).toBeInTheDocument();
    expect(screen.getByTestId('claude-models-dialog-row-implement')).toBeInTheDocument();
    expect(screen.getByTestId('claude-models-dialog-row-quickImpl')).toBeInTheDocument();
    expect(screen.getByTestId('claude-models-dialog-row-verify')).toBeInTheDocument();
  });

  it('shows non-Claude informational message when effective agent is Codex', () => {
    renderWithProviders(
      <ClaudeModelsEditDialog {...baseProps} effectiveAgent={Agent.CODEX} />
    );

    const message = screen.getByTestId('claude-models-non-claude-message');
    expect(message).toBeInTheDocument();
    expect(message.textContent).toContain('Codex');
    expect(
      screen.queryByTestId('claude-models-dialog-row-specify')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('claude-models-dialog-save')).not.toBeInTheDocument();
  });

  it('disables save button when there are no changes', () => {
    renderWithProviders(<ClaudeModelsEditDialog {...baseProps} />);

    expect(screen.getByTestId('claude-models-dialog-save')).toBeDisabled();
  });

  it('disables reset button when there are no overrides', () => {
    renderWithProviders(<ClaudeModelsEditDialog {...baseProps} />);

    expect(screen.getByTestId('claude-models-dialog-reset-all')).toBeDisabled();
  });

  it('enables reset button when overrides are present', () => {
    renderWithProviders(
      <ClaudeModelsEditDialog
        {...baseProps}
        ticketClaudeModelOverrides={{ verify: 'claude-haiku-4-5' }}
      />
    );

    expect(screen.getByTestId('claude-models-dialog-reset-all')).not.toBeDisabled();
  });

  it('clicking reset-all clears overrides and enables save', () => {
    renderWithProviders(
      <ClaudeModelsEditDialog
        {...baseProps}
        ticketClaudeModelOverrides={{
          specify: 'claude-opus-4-6',
          verify: 'claude-haiku-4-5',
        }}
      />
    );

    const resetButton = screen.getByTestId('claude-models-dialog-reset-all');
    fireEvent.click(resetButton);

    expect(screen.getByTestId('claude-models-dialog-save')).not.toBeDisabled();
  });
});
