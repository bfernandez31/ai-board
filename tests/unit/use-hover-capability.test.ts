import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHoverCapability } from '@/lib/hooks/use-hover-capability';

describe('useHoverCapability', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>;
  let addEventListenerMock: ReturnType<typeof vi.fn>;
  let removeEventListenerMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addEventListenerMock = vi.fn();
    removeEventListenerMock = vi.fn();
    matchMediaMock = vi.fn();
    window.matchMedia = matchMediaMock;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when device has hover capability', () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    });

    const { result } = renderHook(() => useHoverCapability());
    expect(result.current).toBe(true);
  });

  it('returns false when device has no hover capability', () => {
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    });

    const { result } = renderHook(() => useHoverCapability());
    expect(result.current).toBe(false);
  });

  it('registers and removes event listener', () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    });

    const { unmount } = renderHook(() => useHoverCapability());
    expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();
    expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('updates when media query changes', () => {
    let changeCallback: (() => void) | null = null;
    const mediaQueryState = { matches: false };

    matchMediaMock.mockImplementation(() => ({
      get matches() { return mediaQueryState.matches; },
      addEventListener: (event: string, listener: () => void) => {
        changeCallback = listener;
        addEventListenerMock(event, listener);
      },
      removeEventListener: removeEventListenerMock,
    }));

    const { result } = renderHook(() => useHoverCapability());
    expect(result.current).toBe(false);

    act(() => {
      mediaQueryState.matches = true;
      changeCallback?.();
    });

    expect(result.current).toBe(true);
  });
});
