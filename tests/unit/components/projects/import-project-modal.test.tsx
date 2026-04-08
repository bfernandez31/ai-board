/**
 * Component Tests: ImportProjectModal
 *
 * Tests the import flow: auth check, reauth prompt, and picker display.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { ImportProjectModal } from '@/components/projects/import-project-modal';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('ImportProjectModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state when opened (T020)', () => {
    // Mock fetch to never resolve so we stay in loading state
    vi.spyOn(global, 'fetch').mockImplementation(
      () => new Promise(() => {})
    );

    render(
      <ImportProjectModal open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Import Project')).toBeInTheDocument();
    expect(screen.getByText('Checking GitHub access...')).toBeInTheDocument();
  });

  it('shows ReauthPrompt when hasRepoScope is false (T025)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ hasGitHubAccount: true, hasRepoScope: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    render(
      <ImportProjectModal open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Additional GitHub Access Required')).toBeInTheDocument();
    });
  });

  it('shows RepoPicker when user has repo scope (T020)', async () => {
    // First call: auth-status returns has scope
    // Subsequent calls: orgs and repos
    vi.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;

      if (url.includes('/api/github/auth-status')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ hasGitHubAccount: true, hasRepoScope: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/api/github/orgs')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ orgs: [] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/api/github/repos')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ repos: [], totalCount: 0, page: 1, perPage: 30, hasNextPage: false }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });

    render(
      <ImportProjectModal open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search repositories...')).toBeInTheDocument();
    });
  });

  it('shows reauth when no GitHub account (T025)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ hasGitHubAccount: false, hasRepoScope: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    render(
      <ImportProjectModal open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Additional GitHub Access Required')).toBeInTheDocument();
    });
  });

  it('shows setup guidance copy on the confirm step', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;

      if (url.includes('/api/github/auth-status')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ hasGitHubAccount: true, hasRepoScope: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/api/github/orgs')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ orgs: [] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/api/github/repos')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              repos: [
                {
                  id: 1,
                  name: 'repo-alpha',
                  fullName: 'octocat/repo-alpha',
                  owner: 'octocat',
                  ownerAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
                  description: 'Alpha repo',
                  isPrivate: false,
                  pushedAt: '2026-03-28T12:00:00Z',
                  hasAdminAccess: true,
                  isAlreadyImported: false,
                  existingProjectId: null,
                },
              ],
              totalCount: 1,
              page: 1,
              perPage: 30,
              hasNextPage: false,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      return Promise.resolve(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    const user = userEvent.setup();

    render(
      <ImportProjectModal open={true} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('octocat/repo-alpha')).toBeInTheDocument();
    });

    await user.click(screen.getByText('octocat/repo-alpha'));

    await waitFor(() => {
      expect(
        screen.getByText(/the import will continue to a project setup screen/i)
      ).toBeInTheDocument();
    });
  });
});
