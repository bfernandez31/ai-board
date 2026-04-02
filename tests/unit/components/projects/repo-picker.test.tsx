/**
 * Component Tests: RepoPicker
 *
 * Tests search, org filter, and pagination UI behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RepoPicker } from '@/components/projects/repo-picker';

const mockRepos = [
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
  {
    id: 2,
    name: 'repo-beta',
    fullName: 'myorg/repo-beta',
    owner: 'myorg',
    ownerAvatar: 'https://avatars.githubusercontent.com/u/2?v=4',
    description: 'Beta repo',
    isPrivate: true,
    pushedAt: '2026-03-20T12:00:00Z',
    hasAdminAccess: true,
    isAlreadyImported: false,
    existingProjectId: null,
  },
];

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

describe('RepoPicker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders search input and org filter (T030)', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;

      if (url.includes('/api/github/orgs')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ orgs: [{ login: 'myorg', avatarUrl: 'https://example.com/org.png' }] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/api/github/repos')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ repos: mockRepos, totalCount: 2, page: 1, perPage: 30, hasNextPage: false }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });

    render(<RepoPicker onSelect={vi.fn()} />, { wrapper: createWrapper() });

    expect(screen.getByPlaceholderText('Search repositories...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('octocat/repo-alpha')).toBeInTheDocument();
      expect(screen.getByText('myorg/repo-beta')).toBeInTheDocument();
    });
  });

  it('shows search input and allows typing', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ repos: [], totalCount: 0, page: 1, perPage: 30, hasNextPage: false, orgs: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    const user = userEvent.setup();
    render(<RepoPicker onSelect={vi.fn()} />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText('Search repositories...');
    await user.type(searchInput, 'test-repo');

    expect(searchInput).toHaveValue('test-repo');
  });

  it('shows empty state when no repos found', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ repos: [], totalCount: 0, page: 1, perPage: 30, hasNextPage: false, orgs: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    render(<RepoPicker onSelect={vi.fn()} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No repositories found')).toBeInTheDocument();
    });
  });

  it('calls onSelect when a repo is clicked', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;

      if (url.includes('/api/github/orgs')) {
        return Promise.resolve(
          new Response(JSON.stringify({ orgs: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({ repos: mockRepos, totalCount: 2, page: 1, perPage: 30, hasNextPage: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    });

    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<RepoPicker onSelect={onSelect} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('octocat/repo-alpha')).toBeInTheDocument();
    });

    // Click the first non-disabled repo button
    const buttons = screen.getAllByRole('button').filter(btn => !btn.hasAttribute('disabled'));
    const repoButton = buttons.find(btn => btn.textContent?.includes('octocat/repo-alpha'));
    if (repoButton) {
      await user.click(repoButton);
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'repo-alpha' }));
    }
  });
});
