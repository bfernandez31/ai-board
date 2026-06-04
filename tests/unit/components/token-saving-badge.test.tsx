import { describe, it, expect } from 'vitest';
import { TokenSavingBadge } from '@/components/ui/token-saving-badge';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';

describe('TokenSavingBadge', () => {
  it('renders with override indicator when isOverride is true', () => {
    renderWithProviders(<TokenSavingBadge isOverride={true} />);
    expect(screen.getByTestId('token-saving-badge')).toBeInTheDocument();
    expect(screen.getByText('(override)')).toBeInTheDocument();
  });

  it('renders without override indicator when isOverride is false', () => {
    renderWithProviders(<TokenSavingBadge isOverride={false} />);
    expect(screen.getByTestId('token-saving-badge')).toBeInTheDocument();
    expect(screen.getByText('Token saving')).toBeInTheDocument();
    expect(screen.queryByText('(override)')).not.toBeInTheDocument();
  });

  it('renders Zap icon', () => {
    renderWithProviders(<TokenSavingBadge isOverride={false} />);
    const badge = screen.getByTestId('token-saving-badge');
    expect(badge.querySelector('svg')).toBeInTheDocument();
  });
});
