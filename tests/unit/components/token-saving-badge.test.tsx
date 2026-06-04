/**
 * Component Tests: TokenSavingBadge (AIB-849, US4)
 *
 * The badge always renders when mounted — the caller is responsible for the
 * `effectiveTokenSaving === true` guard. These tests verify the rendered content
 * and the override indicator; the ON/OFF visibility guard is covered in the
 * ticket-detail-modal test (T030).
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { TokenSavingBadge } from '@/components/ui/token-saving-badge';

describe('TokenSavingBadge', () => {
  it('renders the badge with label and a tooltip', () => {
    renderWithProviders(<TokenSavingBadge />);

    const badge = screen.getByTestId('token-saving-badge');
    expect(badge).toBeInTheDocument();
    expect(screen.getByTestId('token-saving-badge-label')).toHaveTextContent('Token saving');
    // Tooltip text is the source description (inherited by default).
    expect(badge).toHaveAttribute('title', expect.stringContaining('inherited'));
  });

  it('shows the override indicator and override tooltip when isOverride is true', () => {
    renderWithProviders(<TokenSavingBadge isOverride />);

    expect(screen.getByTestId('token-saving-override-label')).toBeInTheDocument();
    expect(screen.getByTestId('token-saving-badge')).toHaveAttribute(
      'title',
      expect.stringContaining('override')
    );
  });

  it('omits the override indicator when inherited', () => {
    renderWithProviders(<TokenSavingBadge isOverride={false} />);

    expect(screen.queryByTestId('token-saving-override-label')).not.toBeInTheDocument();
  });
});
