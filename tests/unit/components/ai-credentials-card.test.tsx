import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { AiCredentialsCard } from '@/components/settings/ai-credentials-card';
import type { ProviderStatusView } from '@/lib/types/ai-credentials';

describe('AiCredentialsCard', () => {
  const initialProviders: ProviderStatusView[] = [
    {
      provider: 'ANTHROPIC',
      status: 'NOT_CONFIGURED',
      validationStatus: null,
      lastFour: null,
      validatedAt: null,
      message: null,
      canManage: true,
    },
    {
      provider: 'OPENAI',
      status: 'CONFIGURED',
      validationStatus: 'VALID',
      lastFour: '1234',
      validatedAt: '2026-03-13T12:00:00.000Z',
      message: 'Credential validated successfully.',
      canManage: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders owner and member states', () => {
    renderWithProviders(<AiCredentialsCard projectId={1} initialProviders={initialProviders} />);

    expect(screen.getByText('Bring Your Own API Keys')).toBeInTheDocument();
    expect(screen.getByText('Save key')).toBeInTheDocument();
    expect(screen.getByText(/only project owners can manage/i)).toBeInTheDocument();
    expect(screen.getByText('Masked suffix: ••••1234')).toBeInTheDocument();
  });

  it('saves a provider key and updates the rendered state', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          provider: 'ANTHROPIC',
          status: 'CONFIGURED',
          validationStatus: 'VALID',
          lastFour: '9999',
          validatedAt: '2026-03-13T12:00:00.000Z',
          message: 'Credential validated successfully.',
          canManage: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    renderWithProviders(<AiCredentialsCard projectId={1} initialProviders={initialProviders} />);

    await user.click(screen.getByText('Save key'));
    await user.type(screen.getByLabelText('API key'), 'anthropic-valid-9999');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/projects/1/ai-credentials/ANTHROPIC', expect.objectContaining({
        method: 'PUT',
      }));
    });

    expect(await screen.findByText('Masked suffix: ••••9999')).toBeInTheDocument();
  });

  it('deletes a configured provider key', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          provider: 'ANTHROPIC',
          status: 'NOT_CONFIGURED',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    renderWithProviders(<AiCredentialsCard projectId={1} initialProviders={[
      {
        ...initialProviders[0],
        status: 'CONFIGURED',
        validationStatus: 'PENDING',
        lastFour: '4321',
        message: 'Credential saved.',
      },
      initialProviders[1],
    ]} />);

    await user.click(screen.getAllByText('Delete')[0]!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/projects/1/ai-credentials/ANTHROPIC', expect.objectContaining({
        method: 'DELETE',
      }));
    });

    expect(await screen.findByText('No stored key suffix visible')).toBeInTheDocument();
  });
});
