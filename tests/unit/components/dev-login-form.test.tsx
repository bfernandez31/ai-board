import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { DevLoginForm } from '@/components/auth/dev-login-form';

const mockSignIn = vi.fn();

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

describe('DevLoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and secret fields with labels', () => {
    renderWithProviders(<DevLoginForm callbackUrl="/projects" />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/secret/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with dev login/i })).toBeInTheDocument();
  });

  it('renders Dev Login divider text', () => {
    renderWithProviders(<DevLoginForm callbackUrl="/projects" />);

    expect(screen.getByText('Dev Login')).toBeInTheDocument();
  });

  it('calls signIn with dev-login provider on form submit', async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({ ok: true });

    renderWithProviders(<DevLoginForm callbackUrl="/projects" />);

    await user.type(screen.getByLabelText(/email/i), 'dev@example.com');
    await user.type(screen.getByLabelText(/secret/i), 'my-secret-123');
    await user.click(screen.getByRole('button', { name: /sign in with dev login/i }));

    expect(mockSignIn).toHaveBeenCalledWith('dev-login', {
      email: 'dev@example.com',
      secret: 'my-secret-123',
      redirect: false,
    });
  });

  it('shows error message when signIn returns an error', async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({ error: 'CredentialsSignin' });

    renderWithProviders(<DevLoginForm callbackUrl="/projects" />);

    await user.type(screen.getByLabelText(/email/i), 'dev@example.com');
    await user.type(screen.getByLabelText(/secret/i), 'wrong-secret');
    await user.click(screen.getByRole('button', { name: /sign in with dev login/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or secret/i);
  });

  it('shows loading state while signing in', async () => {
    const user = userEvent.setup();
    // Never resolve to keep the loading state
    mockSignIn.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<DevLoginForm callbackUrl="/projects" />);

    await user.type(screen.getByLabelText(/email/i), 'dev@example.com');
    await user.type(screen.getByLabelText(/secret/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in with dev login/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });

  it('shows error on unexpected exception', async () => {
    const user = userEvent.setup();
    mockSignIn.mockRejectedValue(new Error('Network error'));

    renderWithProviders(<DevLoginForm callbackUrl="/projects" />);

    await user.type(screen.getByLabelText(/email/i), 'dev@example.com');
    await user.type(screen.getByLabelText(/secret/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in with dev login/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/unexpected error/i);
  });
});
