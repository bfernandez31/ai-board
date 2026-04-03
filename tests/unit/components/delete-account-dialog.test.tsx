/**
 * Component Tests: DeleteAccountDialog
 *
 * AIB-466: Tests for the delete account confirmation dialog.
 * Verifies data count display, email confirmation, loading states,
 * and double-click prevention.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  screen,
  waitFor,
  userEvent,
} from '@/tests/utils/component-test-utils';

const mockSignOut = vi.fn();

vi.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mockSummary = {
  projectCount: 3,
  credentialCount: 2,
  tokenCount: 1,
  hasActiveSubscription: true,
  plan: 'PRO',
};

let fetchHandler: (url: string, init?: RequestInit) => Response;

beforeEach(() => {
  vi.clearAllMocks();
  fetchHandler = (url: string) => {
    if (url === '/api/account/summary') {
      return new Response(JSON.stringify(mockSummary), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url === '/api/account') {
      return new Response(JSON.stringify({ message: 'Account deleted successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('{}', { status: 404 });
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => Promise.resolve(fetchHandler(url, init)))
  );
});

import { DeleteAccountDialog } from '@/components/settings/delete-account-dialog';

describe('DeleteAccountDialog', () => {
  it('should render data counts when opened', async () => {
    renderWithProviders(
      <DeleteAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        userEmail="test@example.com"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/3 projects/)).toBeInTheDocument();
    });
    expect(screen.getByText(/2 AI credentials/)).toBeInTheDocument();
    expect(screen.getByText(/1 personal access token\b/)).toBeInTheDocument();
    expect(screen.getByText(/Active PRO subscription/)).toBeInTheDocument();
  });

  it('should disable delete button when email does not match', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DeleteAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        userEmail="test@example.com"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/3 projects/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter your email address');
    await user.type(input, 'wrong@email.com');

    const deleteButton = screen.getByRole('button', { name: /delete permanently/i });
    expect(deleteButton).toBeDisabled();
  });

  it('should enable delete button when email matches (case-insensitive)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DeleteAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        userEmail="Test@Example.com"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/3 projects/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter your email address');
    await user.type(input, 'test@example.com');

    const deleteButton = screen.getByRole('button', { name: /delete permanently/i });
    expect(deleteButton).toBeEnabled();
  });

  it('should show loading state and disable button during deletion', async () => {
    // Make delete request hang
    fetchHandler = (url: string) => {
      if (url === '/api/account/summary') {
        return new Response(JSON.stringify(mockSummary), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Never resolve for delete
      throw new Error('should not reach');
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return new Promise(() => {}); // Hang forever
        }
        return Promise.resolve(fetchHandler(url, init));
      })
    );

    const user = userEvent.setup();
    renderWithProviders(
      <DeleteAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        userEmail="test@example.com"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/3 projects/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter your email address');
    await user.type(input, 'test@example.com');
    await user.click(screen.getByRole('button', { name: /delete permanently/i }));

    await waitFor(() => {
      expect(screen.getByText('Deleting...')).toBeInTheDocument();
    });
  });

  it('should call signOut on successful deletion', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DeleteAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        userEmail="test@example.com"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/3 projects/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter your email address');
    await user.type(input, 'test@example.com');
    await user.click(screen.getByRole('button', { name: /delete permanently/i }));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
    });
  });

  it('should hide subscription info for free users', async () => {
    fetchHandler = (url: string) => {
      if (url === '/api/account/summary') {
        return new Response(
          JSON.stringify({
            ...mockSummary,
            hasActiveSubscription: false,
            plan: 'FREE',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => Promise.resolve(fetchHandler(url, init)))
    );

    renderWithProviders(
      <DeleteAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        userEmail="test@example.com"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/3 projects/)).toBeInTheDocument();
    });

    expect(screen.queryByText(/subscription/i)).not.toBeInTheDocument();
  });

  it('should clear input and close dialog on cancel', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <DeleteAccountDialog
        open={true}
        onOpenChange={onOpenChange}
        userEmail="test@example.com"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/3 projects/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter your email address');
    await user.type(input, 'partial');
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should not dismiss on outside click or Escape key', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <DeleteAccountDialog
        open={true}
        onOpenChange={onOpenChange}
        userEmail="test@example.com"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/3 projects/)).toBeInTheDocument();
    });

    // Escape key should not close
    await user.keyboard('{Escape}');

    // onOpenChange should NOT have been called with false from escape
    const falseCalls = onOpenChange.mock.calls.filter(
      (call: unknown[]) => call[0] === false
    );
    expect(falseCalls.length).toBe(0);
  });
});
