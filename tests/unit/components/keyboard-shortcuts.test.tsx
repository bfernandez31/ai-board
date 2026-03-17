/**
 * RTL Component Tests: Keyboard Shortcuts (AIB-302)
 *
 * Tests for the keyboard shortcuts hook and help modal.
 * Verifies shortcut behavior, modal rendering, and input suppression.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { useBoardKeyboardShortcuts } from '@/hooks/use-board-keyboard-shortcuts';
import { KeyboardShortcutsModal } from '@/components/board/keyboard-shortcuts-modal';

// Mock matchMedia to simulate desktop device with physical keyboard
function mockMatchMedia(hoverHover: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(hover: hover)' ? hoverHover : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('KeyboardShortcutsModal', () => {
  it('should render all shortcuts when open', () => {
    renderWithProviders(
      <KeyboardShortcutsModal open={true} onOpenChange={vi.fn()} />
    );

    expect(screen.getByRole('heading', { name: /keyboard shortcuts/i })).toBeInTheDocument();
    expect(screen.getByText('N')).toBeInTheDocument();
    expect(screen.getByText('S / /')).toBeInTheDocument();
    expect(screen.getByText('1-6')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  it('should render action descriptions', () => {
    renderWithProviders(
      <KeyboardShortcutsModal open={true} onOpenChange={vi.fn()} />
    );

    expect(screen.getByText(/open new ticket modal/i)).toBeInTheDocument();
    expect(screen.getByText(/focus search input/i)).toBeInTheDocument();
    expect(screen.getByText(/scroll to column/i)).toBeInTheDocument();
  });

  it('should not render content when closed', () => {
    renderWithProviders(
      <KeyboardShortcutsModal open={false} onOpenChange={vi.fn()} />
    );

    expect(screen.queryByRole('heading', { name: /keyboard shortcuts/i })).not.toBeInTheDocument();
  });

  it('should call onOpenChange when close button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <KeyboardShortcutsModal open={true} onOpenChange={onOpenChange} />
    );

    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('useBoardKeyboardShortcuts', () => {
  const defaultOptions = {
    onNewTicket: vi.fn(),
    onToggleHelp: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia(true); // Desktop with physical keyboard
    localStorage.clear();
    // Mark as dismissed to prevent auto-show
    localStorage.setItem('shortcuts-hint-dismissed', 'true');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should call onNewTicket when N is pressed', () => {
    renderHook(() => useBoardKeyboardShortcuts(defaultOptions));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
    });

    expect(defaultOptions.onNewTicket).toHaveBeenCalledTimes(1);
  });

  it('should dispatch focus-search event when S is pressed', () => {
    const handler = vi.fn();
    document.addEventListener('board:focus-search', handler);

    renderHook(() => useBoardKeyboardShortcuts(defaultOptions));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    });

    expect(handler).toHaveBeenCalledTimes(1);
    document.removeEventListener('board:focus-search', handler);
  });

  it('should dispatch focus-search event when / is pressed', () => {
    const handler = vi.fn();
    document.addEventListener('board:focus-search', handler);

    renderHook(() => useBoardKeyboardShortcuts(defaultOptions));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
    });

    expect(handler).toHaveBeenCalledTimes(1);
    document.removeEventListener('board:focus-search', handler);
  });

  it('should toggle help overlay when ? is pressed', () => {
    const { result } = renderHook(() => useBoardKeyboardShortcuts(defaultOptions));

    expect(result.current.isHelpOpen).toBe(false);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });

    expect(result.current.isHelpOpen).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });

    expect(result.current.isHelpOpen).toBe(false);
  });

  it('should scroll to column when number 1-6 is pressed', () => {
    // Create mock column elements
    const columns = ['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP'];
    const elements: HTMLDivElement[] = [];
    columns.forEach((stage) => {
      const el = document.createElement('div');
      el.dataset.stage = stage;
      el.scrollIntoView = vi.fn();
      document.body.appendChild(el);
      elements.push(el);
    });

    renderHook(() => useBoardKeyboardShortcuts(defaultOptions));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    });

    // PLAN column (index 2) should have been scrolled to
    expect(elements[2].scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });

    // Cleanup
    elements.forEach((el) => el.remove());
  });

  it('should not trigger shortcuts when text input is focused', () => {
    renderHook(() => useBoardKeyboardShortcuts(defaultOptions));

    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    input.focus();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
    });

    expect(defaultOptions.onNewTicket).not.toHaveBeenCalled();

    input.remove();
  });

  it('should not trigger shortcuts when textarea is focused', () => {
    renderHook(() => useBoardKeyboardShortcuts(defaultOptions));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
    });

    expect(defaultOptions.onNewTicket).not.toHaveBeenCalled();

    textarea.remove();
  });

  it('should not trigger shortcuts when modifier keys are held', () => {
    renderHook(() => useBoardKeyboardShortcuts(defaultOptions));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }));
    });

    expect(defaultOptions.onNewTicket).not.toHaveBeenCalled();
  });

  it('should not trigger shortcuts on touch-only devices', () => {
    mockMatchMedia(false); // Touch-only device

    renderHook(() => useBoardKeyboardShortcuts(defaultOptions));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
    });

    expect(defaultOptions.onNewTicket).not.toHaveBeenCalled();
  });

  it('should show help on first visit', () => {
    localStorage.removeItem('shortcuts-hint-dismissed');

    const { result } = renderHook(() => useBoardKeyboardShortcuts(defaultOptions));

    expect(result.current.isHelpOpen).toBe(true);
    expect(localStorage.getItem('shortcuts-hint-dismissed')).toBe('true');
  });

  it('should not show help on subsequent visits', () => {
    localStorage.setItem('shortcuts-hint-dismissed', 'true');

    const { result } = renderHook(() => useBoardKeyboardShortcuts(defaultOptions));

    expect(result.current.isHelpOpen).toBe(false);
  });

  it('should close help overlay on Escape', () => {
    const { result } = renderHook(() => useBoardKeyboardShortcuts(defaultOptions));

    // Open help
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    expect(result.current.isHelpOpen).toBe(true);

    // Close with Escape
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.isHelpOpen).toBe(false);
  });

  it('should not trigger other shortcuts when help overlay is open', () => {
    const { result } = renderHook(() => useBoardKeyboardShortcuts(defaultOptions));

    // Open help
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    expect(result.current.isHelpOpen).toBe(true);

    // Try N shortcut - should not trigger
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
    });
    expect(defaultOptions.onNewTicket).not.toHaveBeenCalled();
  });
});
