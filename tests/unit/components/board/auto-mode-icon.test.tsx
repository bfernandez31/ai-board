/**
 * RTL Tests: AutoModeIcon (AIB-682)
 * Verifies hover-only off-state, indigo halo on-state, and tooltip text.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { AutoModeIcon } from '@/components/board/auto-mode-icon';

describe('AutoModeIcon', () => {
  it('off-state is hover-only (opacity-0 group-hover:opacity-100)', () => {
    renderWithProviders(
      <AutoModeIcon autoMode={false} onClick={vi.fn()} />
    );
    const btn = screen.getByTestId('auto-mode-icon');
    expect(btn.className).toContain('opacity-0');
    expect(btn.className).toContain('group-hover:opacity-100');
    expect(btn.className).not.toContain('ring-2');
  });

  it('on-state renders with indigo ring halo and is always visible', () => {
    renderWithProviders(
      <AutoModeIcon autoMode={true} onClick={vi.fn()} />
    );
    const btn = screen.getByTestId('auto-mode-icon');
    expect(btn.className).toContain('opacity-100');
    expect(btn.className).toContain('ring-2');
    expect(btn.className).toContain('ring-indigo-500');
  });

  it('tooltip label differs by state (off)', () => {
    renderWithProviders(
      <AutoModeIcon autoMode={false} onClick={vi.fn()} />
    );
    expect(screen.getByTestId('auto-mode-icon')).toHaveAttribute(
      'aria-label',
      'Enable auto-transition'
    );
  });

  it('tooltip label differs by state (on)', () => {
    renderWithProviders(
      <AutoModeIcon autoMode={true} onClick={vi.fn()} />
    );
    expect(screen.getByTestId('auto-mode-icon')).toHaveAttribute(
      'aria-label',
      'Auto-transition on — click to disable'
    );
  });

  it('fires onClick when clicked (on-state, no modal involvement)', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <AutoModeIcon autoMode={true} onClick={onClick} />
    );
    await user.click(screen.getByTestId('auto-mode-icon'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled=true', () => {
    renderWithProviders(
      <AutoModeIcon autoMode={false} onClick={vi.fn()} disabled />
    );
    expect(screen.getByTestId('auto-mode-icon')).toBeDisabled();
  });
});
