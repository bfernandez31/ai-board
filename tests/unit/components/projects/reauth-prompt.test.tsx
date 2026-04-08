/**
 * Component Tests: ReauthPrompt
 *
 * Tests the OAuth re-authorization prompt UI and interactions.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next-auth/react before import
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

import { ReauthPrompt } from '@/components/projects/reauth-prompt';
import { signIn } from 'next-auth/react';

describe('ReauthPrompt', () => {
  it('renders scope explanation and re-authorize button (T024)', () => {
    render(<ReauthPrompt onDismiss={vi.fn()} />);

    expect(screen.getByText('Additional GitHub Access Required')).toBeInTheDocument();
    expect(screen.getByText(/permission to read your GitHub repositories/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Authorize GitHub Access/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Not now/i })).toBeInTheDocument();
  });

  it('calls signIn("github") when authorize button is clicked', async () => {
    const user = userEvent.setup();
    render(<ReauthPrompt onDismiss={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Authorize GitHub Access/i }));

    expect(signIn).toHaveBeenCalledWith('github', { callbackUrl: expect.any(String) }, { scope: 'read:user user:email repo' });
  });

  it('calls onDismiss when "Not now" is clicked', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<ReauthPrompt onDismiss={onDismiss} />);

    await user.click(screen.getByRole('button', { name: /Not now/i }));

    expect(onDismiss).toHaveBeenCalled();
  });

});
