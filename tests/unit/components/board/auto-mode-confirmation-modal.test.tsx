/**
 * RTL Tests: AutoModeConfirmationModal (AIB-682)
 * Verifies stage-preview text and confirm/cancel callbacks.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Stage } from '@prisma/client';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { AutoModeConfirmationModal } from '@/components/board/auto-mode-confirmation-modal';

function renderModal(stage: Stage, onConfirm = vi.fn(), onOpenChange = vi.fn()) {
  return renderWithProviders(
    <AutoModeConfirmationModal
      open
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      currentStage={stage}
    />
  );
}

describe('AutoModeConfirmationModal', () => {
  it('renders SPECIFY → PLAN → BUILD preview for INBOX', () => {
    renderModal('INBOX');
    expect(screen.getByTestId('auto-mode-preview')).toHaveTextContent(
      'SPECIFY → PLAN → BUILD will run automatically.'
    );
  });

  it('renders PLAN → BUILD preview for SPECIFY', () => {
    renderModal('SPECIFY');
    expect(screen.getByTestId('auto-mode-preview')).toHaveTextContent(
      'PLAN → BUILD will run automatically.'
    );
  });

  it('renders BUILD preview for PLAN', () => {
    renderModal('PLAN');
    expect(screen.getByTestId('auto-mode-preview')).toHaveTextContent(
      'BUILD will run automatically.'
    );
  });

  it('fires onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderModal('INBOX', onConfirm);
    await user.click(screen.getByTestId('auto-mode-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not fire onConfirm when cancel clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderModal('INBOX', onConfirm);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
