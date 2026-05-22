import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { FloatingActionBar } from '@/components/board/floating-action-bar';

describe('FloatingActionBar', () => {
  const defaultProps = {
    selectedCount: 3,
    onDelete: vi.fn(),
    onMerge: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should render with selected count', () => {
    renderWithProviders(<FloatingActionBar {...defaultProps} />);
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('should render delete and merge buttons', () => {
    renderWithProviders(<FloatingActionBar {...defaultProps} />);
    expect(screen.getByTestId('bulk-delete-button')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-merge-button')).toBeInTheDocument();
  });

  it('should disable merge when fewer than 2 selected', () => {
    renderWithProviders(<FloatingActionBar {...defaultProps} selectedCount={1} />);
    expect(screen.getByTestId('bulk-merge-button')).toBeDisabled();
  });

  it('should enable merge when 2+ selected', () => {
    renderWithProviders(<FloatingActionBar {...defaultProps} selectedCount={2} />);
    expect(screen.getByTestId('bulk-merge-button')).not.toBeDisabled();
  });

  it('should call onDelete when delete is clicked', async () => {
    const onDelete = vi.fn();
    renderWithProviders(<FloatingActionBar {...defaultProps} onDelete={onDelete} />);
    screen.getByTestId('bulk-delete-button').click();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('should call onMerge when merge is clicked', async () => {
    const onMerge = vi.fn();
    renderWithProviders(<FloatingActionBar {...defaultProps} onMerge={onMerge} />);
    screen.getByTestId('bulk-merge-button').click();
    expect(onMerge).toHaveBeenCalledOnce();
  });

  it('should call onCancel when cancel is clicked', async () => {
    const onCancel = vi.fn();
    renderWithProviders(<FloatingActionBar {...defaultProps} onCancel={onCancel} />);
    screen.getByTestId('bulk-cancel-button').click();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('should not render when selectedCount is 0', () => {
    const { container } = renderWithProviders(
      <FloatingActionBar {...defaultProps} selectedCount={0} />
    );
    expect(container.firstChild).toBeNull();
  });
});
