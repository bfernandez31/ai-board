import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { BulkActionBar } from '@/components/board/bulk-action-bar';

describe('BulkActionBar', () => {
  it('shows the selection count and disabled action states', () => {
    const onDelete = vi.fn();
    const onChangeAgent = vi.fn();
    const onChangeModel = vi.fn();
    renderWithProviders(
      <BulkActionBar
        isVisible={true}
        selectedCount={3}
        onCancel={vi.fn()}
        onDelete={onDelete}
        onChangeAgent={onChangeAgent}
        onChangeModel={onChangeModel}
      />
    );

    expect(screen.getByText('3 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Merge selected tickets' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change agent for selected tickets' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Change model for selected tickets' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete selected tickets' })).toBeEnabled();
  });

  it('invokes cancel and hides entirely when not visible', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { rerender } = renderWithProviders(
      <BulkActionBar isVisible={true} selectedCount={1} onCancel={onCancel} />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel bulk selection' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(<BulkActionBar isVisible={false} selectedCount={1} onCancel={onCancel} />);
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
  });
});
