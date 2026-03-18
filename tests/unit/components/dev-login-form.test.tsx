/**
 * Component Tests: DevLoginForm
 *
 * Tests for the dev login form component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next-auth/react
const mockSignIn = vi.fn();
vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Import after mocks
import { DevLoginForm } from '@/components/auth/dev-login-form';

describe('DevLoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render email and secret inputs', () => {
    render(<DevLoginForm callbackUrl="/projects" />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Secret')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with dev login/i })).toBeInTheDocument();
  });

  it('should disable submit button when fields are empty', () => {
    render(<DevLoginForm callbackUrl="/projects" />);

    const button = screen.getByRole('button', { name: /sign in with dev login/i });
    expect(button).toBeDisabled();
  });

  it('should call signIn with correct params on submit', async () => {
    mockSignIn.mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    render(<DevLoginForm callbackUrl="/projects" />);

    await user.type(screen.getByLabelText('Email'), 'dev@example.com');
    await user.type(screen.getByLabelText('Secret'), 'my-secret-value');

    const button = screen.getByRole('button', { name: /sign in with dev login/i });
    await user.click(button);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: 'dev@example.com',
        secret: 'my-secret-value',
        redirect: false,
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/projects');
    });
  });

  it('should display error on failed login', async () => {
    mockSignIn.mockResolvedValue({ ok: false, error: 'CredentialsSignin' });
    const user = userEvent.setup();

    render(<DevLoginForm callbackUrl="/projects" />);

    await user.type(screen.getByLabelText('Email'), 'dev@example.com');
    await user.type(screen.getByLabelText('Secret'), 'wrong-secret');

    const button = screen.getByRole('button', { name: /sign in with dev login/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
