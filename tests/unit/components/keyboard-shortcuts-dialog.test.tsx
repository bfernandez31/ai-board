import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { KeyboardShortcutsDialog } from '@/components/board/keyboard-shortcuts-dialog';

describe('KeyboardShortcutsDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all shortcuts when open', () => {
    renderWithProviders(<KeyboardShortcutsDialog {...defaultProps} />);

    expect(screen.getByText('Create new ticket')).toBeInTheDocument();
    expect(screen.getByText('Focus search')).toBeInTheDocument();
    expect(screen.getByText('Jump to column')).toBeInTheDocument();
    expect(screen.getByText('Toggle this help')).toBeInTheDocument();
    expect(screen.getByText('Close modal / overlay')).toBeInTheDocument();
  });

  it('renders kbd elements for shortcut keys', () => {
    renderWithProviders(<KeyboardShortcutsDialog {...defaultProps} />);

    expect(screen.getByText('N')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('1 - 6')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  it('has accessible dialog role and heading', () => {
    renderWithProviders(<KeyboardShortcutsDialog {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /keyboard shortcuts/i })).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderWithProviders(<KeyboardShortcutsDialog open={false} onOpenChange={vi.fn()} />);

    expect(screen.queryByText('Create new ticket')).not.toBeInTheDocument();
  });

  it('calls onOpenChange when close button is clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<KeyboardShortcutsDialog open={true} onOpenChange={onOpenChange} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
