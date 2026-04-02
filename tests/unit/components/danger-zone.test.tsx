/**
 * Component Tests: DangerZone
 *
 * AIB-466: Tests for the danger zone section on the profile page.
 * Verifies rendering and dialog open behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from '@/tests/utils/component-test-utils';

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            projectCount: 0,
            credentialCount: 0,
            tokenCount: 0,
            hasActiveSubscription: false,
            plan: 'FREE',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )
  );
});

import { DangerZone } from '@/components/settings/danger-zone';

describe('DangerZone', () => {
  it('should render danger zone with delete button', () => {
    renderWithProviders(<DangerZone userEmail="test@example.com" />);

    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
    expect(
      screen.getByText(/permanently delete your account/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete my account/i })
    ).toBeInTheDocument();
  });

  it('should open dialog when delete button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DangerZone userEmail="test@example.com" />);

    await user.click(screen.getByRole('button', { name: /delete my account/i }));

    await waitFor(() => {
      expect(screen.getByText('Delete your account')).toBeInTheDocument();
    });
  });
});
