import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/tests/utils/component-test-utils';
import { BulkDeleteConfirmationModal } from '@/components/board/bulk-delete-confirmation-modal';

describe('BulkDeleteConfirmationModal', () => {
  it('shows the correct count in the title and confirm button', () => {
    renderWithProviders(
      <BulkDeleteConfirmationModal
        open
        count={5}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByTestId('bulk-delete-title').textContent).toContain('5');
    expect(screen.getByTestId('bulk-delete-confirm').textContent).toContain('5');
  });

  it('warns about permanent deletion in the body', () => {
    renderWithProviders(
      <BulkDeleteConfirmationModal
        open
        count={2}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(document.body.textContent).toMatch(/permanently delete/i);
  });

  it('calls onOpenChange with false when Cancel is clicked', () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <BulkDeleteConfirmationModal
        open
        count={2}
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('bulk-delete-cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('fires onConfirm when Delete button is clicked', () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <BulkDeleteConfirmationModal
        open
        count={2}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByTestId('bulk-delete-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables buttons while deleting', () => {
    renderWithProviders(
      <BulkDeleteConfirmationModal
        open
        count={2}
        isDeleting
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByTestId('bulk-delete-confirm')).toBeDisabled();
    expect(screen.getByTestId('bulk-delete-cancel')).toBeDisabled();
  });
});
