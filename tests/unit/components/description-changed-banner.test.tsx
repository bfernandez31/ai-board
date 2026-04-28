import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { DescriptionChangedBanner } from '@/components/ticket/description-changed-banner';

describe('DescriptionChangedBanner', () => {
  it('renders with role=alert and aria-live=polite', () => {
    renderWithProviders(
      <DescriptionChangedBanner onReanalyze={() => undefined} />
    );
    const banner = screen.getByTestId('description-changed-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('exposes a keyboard-operable re-analyze button', async () => {
    const onReanalyze = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<DescriptionChangedBanner onReanalyze={onReanalyze} />);
    const btn = screen.getByTestId('reanalyze-button');
    btn.focus();
    expect(btn).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onReanalyze).toHaveBeenCalledTimes(1);
  });

  it('disables the re-analyze button when disabled=true', () => {
    renderWithProviders(
      <DescriptionChangedBanner onReanalyze={() => undefined} disabled />
    );
    expect(screen.getByTestId('reanalyze-button')).toBeDisabled();
  });
});
