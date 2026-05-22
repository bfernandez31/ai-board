import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/tests/utils/component-test-utils';
import { BulkActionBar } from '@/components/board/bulk-action-bar';

function noopHandlers() {
  return {
    onCancel: vi.fn(),
    onMerge: vi.fn(),
    onDelete: vi.fn(),
    onAgentChange: vi.fn(),
    onModelChange: vi.fn(),
  };
}

describe('BulkActionBar', () => {
  it('does not render when count is zero', () => {
    renderWithProviders(<BulkActionBar count={0} {...noopHandlers()} />);
    expect(screen.queryByTestId('bulk-action-bar')).toBeNull();
  });

  it('renders a polite live count', () => {
    renderWithProviders(<BulkActionBar count={3} {...noopHandlers()} />);
    const counter = screen.getByTestId('bulk-count');
    expect(counter.getAttribute('aria-live')).toBe('polite');
    expect(counter.textContent).toContain('3 selected');
  });

  it('disables merge when count < 2', () => {
    renderWithProviders(<BulkActionBar count={1} {...noopHandlers()} />);
    expect(screen.getByTestId('bulk-merge-button')).toBeDisabled();
    expect(screen.getByTestId('bulk-delete-button')).not.toBeDisabled();
  });

  it('disables every action when count > 50', () => {
    renderWithProviders(<BulkActionBar count={51} {...noopHandlers()} />);
    expect(screen.getByTestId('bulk-merge-button')).toBeDisabled();
    expect(screen.getByTestId('bulk-delete-button')).toBeDisabled();
    const merge = screen.getByTestId('bulk-merge-button');
    expect(merge.getAttribute('title')).toContain('50');
  });

  it('fires onCancel when Cancel is clicked', () => {
    const handlers = noopHandlers();
    renderWithProviders(<BulkActionBar count={2} {...handlers} />);
    fireEvent.click(screen.getByTestId('bulk-cancel-button'));
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
  });

  it('fires onMerge and onDelete handlers', () => {
    const handlers = noopHandlers();
    renderWithProviders(<BulkActionBar count={3} {...handlers} />);
    fireEvent.click(screen.getByTestId('bulk-merge-button'));
    fireEvent.click(screen.getByTestId('bulk-delete-button'));
    expect(handlers.onMerge).toHaveBeenCalledTimes(1);
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
  });
});
