import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { TokenSavingCard } from '@/components/settings/token-saving-card';

const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

function okFetch(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ tokenSavingEnabled: true }),
  });
}

describe('TokenSavingCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the OFF initial state', () => {
    renderWithProviders(
      <TokenSavingCard project={{ id: 1, tokenSavingEnabled: false }} canEdit />
    );

    expect(screen.getByText('Token saving')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /enable token saving/i })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('lets an owner toggle token saving and refreshes server data after save', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(
      <TokenSavingCard project={{ id: 4, tokenSavingEnabled: false }} canEdit />
    );

    await userEvent.click(screen.getByRole('switch', { name: /enable token saving/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/projects/4', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenSavingEnabled: true }),
      });
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('On')).toBeInTheDocument();
  });

  it('renders read-only controls for non-owners', () => {
    renderWithProviders(
      <TokenSavingCard project={{ id: 1, tokenSavingEnabled: true }} canEdit={false} />
    );

    expect(screen.getByRole('switch', { name: /token saving is managed by project owners/i })).toBeDisabled();
    expect(screen.getByText('Owners only')).toBeInTheDocument();
  });

  it('shows a validation error and restores state when save fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Validation failed' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(
      <TokenSavingCard project={{ id: 1, tokenSavingEnabled: false }} canEdit />
    );

    await userEvent.click(screen.getByRole('switch', { name: /enable token saving/i }));

    expect(await screen.findByText('Validation failed')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
