/**
 * RTL Component Tests: ModelOverrideDialog (AIB-678 / US3)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { ModelOverrideDialog } from '@/components/tickets/model-override-dialog';
import { Agent } from '@prisma/client';

const baseCurrent = {
  specifyModel: null,
  planModel: null,
  implementModel: null,
  quickImplModel: null,
  verifyModel: null,
};

function renderDialog(
  overrides: Partial<Parameters<typeof ModelOverrideDialog>[0]> = {}
) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const props = {
    open: true,
    onOpenChange,
    effectiveAgent: Agent.CLAUDE,
    current: baseCurrent,
    onSave,
    ...overrides,
  };
  const utils = renderWithProviders(<ModelOverrideDialog {...props} />);
  return { ...utils, onSave, onOpenChange };
}

describe('ModelOverrideDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 5 stage rows for a Claude ticket', () => {
    renderDialog();

    expect(screen.getByTestId('row-specifyModel')).toBeInTheDocument();
    expect(screen.getByTestId('row-planModel')).toBeInTheDocument();
    expect(screen.getByTestId('row-implementModel')).toBeInTheDocument();
    expect(screen.getByTestId('row-quickImplModel')).toBeInTheDocument();
    expect(screen.getByTestId('row-verifyModel')).toBeInTheDocument();
  });

  it('shows inactive message when effective agent is not Claude', () => {
    renderDialog({ effectiveAgent: Agent.GEMINI });

    expect(screen.getByTestId('model-override-inactive')).toBeInTheDocument();
    expect(screen.queryByTestId('row-specifyModel')).not.toBeInTheDocument();
  });

  it('disables save when there are no changes', () => {
    renderDialog();

    const saveButton = screen.getByTestId('save-model-overrides');
    expect(saveButton).toBeDisabled();
  });

  it('clears all selections when "Reset all to project defaults" is clicked', async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog({
      current: { ...baseCurrent, verifyModel: 'claude-opus-4-7' },
    });

    // Save initially enabled-check skipped; just click reset — the selection
    // becomes all-null and `hasChanges` is true because current has a non-null.
    await user.click(screen.getByTestId('reset-all-overrides'));

    const saveButton = screen.getByTestId('save-model-overrides');
    expect(saveButton).not.toBeDisabled();
    await user.click(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ resetAll: true });
  });

  it('preserves in-progress selection when parent re-renders with a new current object reference', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const initialCurrent = { ...baseCurrent, verifyModel: 'claude-opus-4-7' };

    const { rerender } = renderWithProviders(
      <ModelOverrideDialog
        open
        onOpenChange={onOpenChange}
        effectiveAgent={Agent.CLAUDE}
        current={initialCurrent}
        onSave={onSave}
      />
    );

    await user.click(screen.getByTestId('reset-all-overrides'));
    const saveButton = screen.getByTestId('save-model-overrides');
    expect(saveButton).not.toBeDisabled();

    // Simulate parent re-render caused by job polling: same values, new object ref.
    rerender(
      <ModelOverrideDialog
        open
        onOpenChange={onOpenChange}
        effectiveAgent={Agent.CLAUDE}
        current={{ ...initialCurrent }}
        onSave={onSave}
      />
    );

    expect(saveButton).not.toBeDisabled();
  });

  it('surfaces an error when onSave rejects and keeps dialog open', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('API exploded'));
    const onOpenChange = vi.fn();

    renderWithProviders(
      <ModelOverrideDialog
        open
        onOpenChange={onOpenChange}
        effectiveAgent={Agent.CLAUDE}
        current={{ ...baseCurrent, verifyModel: 'claude-opus-4-7' }}
        onSave={onSave}
      />
    );

    await user.click(screen.getByTestId('reset-all-overrides'));
    await user.click(screen.getByTestId('save-model-overrides'));

    expect(onSave).toHaveBeenCalled();
    expect(await screen.findByText('API exploded')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
