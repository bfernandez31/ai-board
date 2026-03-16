import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

const redirectMock = vi.fn();
const getCurrentUserOrNullMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

vi.mock('@/lib/db/users', () => ({
  getCurrentUserOrNull: () => getCurrentUserOrNullMock(),
}));

vi.mock('@/app/landing/page', () => ({
  default: () => React.createElement('div', { 'data-testid': 'landing-page' }, 'Landing Page'),
}));

describe('Home route', () => {
  beforeEach(() => {
    redirectMock.mockReset();
    getCurrentUserOrNullMock.mockReset();
  });

  it('renders the landing page for unauthenticated visitors', async () => {
    getCurrentUserOrNullMock.mockResolvedValue(null);
    const { default: Home } = await import('@/app/page');

    const result = await Home();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });

  it('redirects authenticated visitors to /projects', async () => {
    getCurrentUserOrNullMock.mockResolvedValue({ id: 1, email: 'test@example.com' });
    const { default: Home } = await import('@/app/page');

    await Home();

    expect(redirectMock).toHaveBeenCalledWith('/projects');
  });
});
