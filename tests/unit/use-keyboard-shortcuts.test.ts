import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';

function fireKey(key: string, target?: EventTarget | null, modifiers?: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers });
  if (target) {
    Object.defineProperty(event, 'target', { value: target });
  }
  document.dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcuts', () => {
  const defaultCallbacks = () => ({
    enabled: true,
    blocked: false,
    onNewTicket: vi.fn(),
    onFocusSearch: vi.fn(),
    onColumnNav: vi.fn(),
    onToggleHelp: vi.fn(),
  });

  let callbacks: ReturnType<typeof defaultCallbacks>;

  beforeEach(() => {
    callbacks = defaultCallbacks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fires onNewTicket when N is pressed', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireKey('n');
    expect(callbacks.onNewTicket).toHaveBeenCalledOnce();
  });

  it('fires onNewTicket when uppercase N is pressed', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireKey('N');
    expect(callbacks.onNewTicket).toHaveBeenCalledOnce();
  });

  it('fires onFocusSearch when S is pressed', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireKey('s');
    expect(callbacks.onFocusSearch).toHaveBeenCalledOnce();
  });

  it('fires onFocusSearch when / is pressed', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireKey('/');
    expect(callbacks.onFocusSearch).toHaveBeenCalledOnce();
  });

  it('fires onColumnNav with correct index for keys 1-6', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    for (let i = 1; i <= 6; i++) {
      fireKey(String(i));
    }
    expect(callbacks.onColumnNav).toHaveBeenCalledTimes(6);
    expect(callbacks.onColumnNav).toHaveBeenNthCalledWith(1, 1);
    expect(callbacks.onColumnNav).toHaveBeenNthCalledWith(2, 2);
    expect(callbacks.onColumnNav).toHaveBeenNthCalledWith(3, 3);
    expect(callbacks.onColumnNav).toHaveBeenNthCalledWith(4, 4);
    expect(callbacks.onColumnNav).toHaveBeenNthCalledWith(5, 5);
    expect(callbacks.onColumnNav).toHaveBeenNthCalledWith(6, 6);
  });

  it('fires onToggleHelp when ? is pressed', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireKey('?');
    expect(callbacks.onToggleHelp).toHaveBeenCalledOnce();
  });

  it('calls preventDefault on matched shortcuts', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does not fire callbacks when enabled is false', () => {
    callbacks.enabled = false;
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireKey('n');
    fireKey('s');
    fireKey('1');
    fireKey('?');
    expect(callbacks.onNewTicket).not.toHaveBeenCalled();
    expect(callbacks.onFocusSearch).not.toHaveBeenCalled();
    expect(callbacks.onColumnNav).not.toHaveBeenCalled();
    expect(callbacks.onToggleHelp).not.toHaveBeenCalled();
  });

  it('does not fire callbacks when blocked is true', () => {
    callbacks.blocked = true;
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireKey('n');
    fireKey('s');
    expect(callbacks.onNewTicket).not.toHaveBeenCalled();
    expect(callbacks.onFocusSearch).not.toHaveBeenCalled();
  });

  it('does not fire callbacks when target is an INPUT element', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    const input = document.createElement('input');
    fireKey('n', input);
    expect(callbacks.onNewTicket).not.toHaveBeenCalled();
  });

  it('does not fire callbacks when target is a TEXTAREA element', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    const textarea = document.createElement('textarea');
    fireKey('n', textarea);
    expect(callbacks.onNewTicket).not.toHaveBeenCalled();
  });

  it('does not fire callbacks when target is a SELECT element', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    const select = document.createElement('select');
    fireKey('s', select);
    expect(callbacks.onFocusSearch).not.toHaveBeenCalled();
  });

  it('does not fire callbacks when target is contentEditable', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    const div = document.createElement('div');
    div.contentEditable = 'true';
    fireKey('n', div);
    expect(callbacks.onNewTicket).not.toHaveBeenCalled();
  });

  it('does not fire callbacks when metaKey is held', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireKey('n', null, { metaKey: true });
    expect(callbacks.onNewTicket).not.toHaveBeenCalled();
  });

  it('does not fire callbacks when ctrlKey is held', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireKey('s', null, { ctrlKey: true });
    expect(callbacks.onFocusSearch).not.toHaveBeenCalled();
  });

  it('does not fire callbacks when altKey is held', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireKey('n', null, { altKey: true });
    expect(callbacks.onNewTicket).not.toHaveBeenCalled();
  });

  it('does not fire callbacks for unmatched keys', () => {
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireKey('a');
    fireKey('7');
    fireKey('Escape');
    expect(callbacks.onNewTicket).not.toHaveBeenCalled();
    expect(callbacks.onFocusSearch).not.toHaveBeenCalled();
    expect(callbacks.onColumnNav).not.toHaveBeenCalled();
    expect(callbacks.onToggleHelp).not.toHaveBeenCalled();
  });

  it('removes listener on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts(callbacks));
    unmount();
    fireKey('n');
    expect(callbacks.onNewTicket).not.toHaveBeenCalled();
  });
});
