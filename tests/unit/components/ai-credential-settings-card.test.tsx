import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiCredentialReadinessStatus, AiCredentialProvider, AiCredentialType } from '@prisma/client';
import { AiCredentialSettingsCard } from '@/components/ai-credentials/credential-settings-card';

const mockUseAiCredentials = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('@/lib/hooks/mutations/useAiCredentials', () => ({
  useAiCredentials: () => mockUseAiCredentials(),
  useSaveAiCredential: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useDeleteAiCredential: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AiCredentialSettingsCard />
    </QueryClientProvider>
  );
}

describe('AiCredentialSettingsCard', () => {
  beforeEach(() => {
    mockUseAiCredentials.mockReturnValue({
      data: {
        credentials: [],
      },
      isLoading: false,
      error: null,
    });
    mockMutateAsync.mockReset();
  });

  it('renders empty state and opens the save dialog', async () => {
    const user = userEvent.setup();
    renderCard();

    expect(screen.getByText(/No AI credentials saved yet/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add credential/i }));

    expect(screen.getByText(/Save AI Credential/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Credential type/i)).toBeInTheDocument();
  });

  it('shows inline validation and disables submit until the secret is valid', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('button', { name: /add credential/i }));

    const saveButton = screen.getByRole('button', { name: /^save credential$/i });
    expect(saveButton).toBeDisabled();

    await user.type(screen.getByLabelText(/Label/i), 'Primary Anthropic');
    await user.type(screen.getByLabelText(/Secret/i), 'bad-secret');

    expect(screen.getByText(/must start with sk-ant-/i)).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
  });

  it('renders saved credential status metadata', () => {
    mockUseAiCredentials.mockReturnValue({
      data: {
        credentials: [
          {
            provider: AiCredentialProvider.ANTHROPIC,
            credentialType: AiCredentialType.ANTHROPIC_API_KEY,
            label: 'Primary Anthropic',
            maskedPreview: '5678',
            readinessStatus: AiCredentialReadinessStatus.READY,
            lastVerifiedAt: null,
            lastVerificationCode: null,
            lastVerificationMessage: null,
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    renderCard();

    expect(screen.getByText('Primary Anthropic')).toBeInTheDocument();
    expect(screen.getByText(/Anthropic • API key/i)).toBeInTheDocument();
    expect(screen.getByText(/^Ready$/)).toBeInTheDocument();
    expect(screen.getByText('...5678')).toBeInTheDocument();
  });

  it('submits a valid credential', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue({
      credential: {
        provider: AiCredentialProvider.ANTHROPIC,
        credentialType: AiCredentialType.ANTHROPIC_API_KEY,
        label: 'Primary Anthropic',
        maskedPreview: '5678',
        readinessStatus: AiCredentialReadinessStatus.READY,
        lastVerifiedAt: null,
        lastVerificationCode: null,
        lastVerificationMessage: null,
        updatedAt: new Date().toISOString(),
      },
    });

    renderCard();

    await user.click(screen.getByRole('button', { name: /add credential/i }));
    await user.type(screen.getByLabelText(/Label/i), 'Primary Anthropic');
    await user.type(screen.getByLabelText(/Secret/i), 'sk-ant-valid-secret-12345678');

    await user.click(screen.getByRole('button', { name: /^save credential$/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        provider: AiCredentialProvider.ANTHROPIC,
        credentialType: AiCredentialType.ANTHROPIC_API_KEY,
        label: 'Primary Anthropic',
        secret: 'sk-ant-valid-secret-12345678',
      });
    });
  });

  it('opens the delete confirmation dialog when a credential exists', async () => {
    const user = userEvent.setup();
    mockUseAiCredentials.mockReturnValue({
      data: {
        credentials: [
          {
            provider: AiCredentialProvider.ANTHROPIC,
            credentialType: AiCredentialType.ANTHROPIC_API_KEY,
            label: 'Primary Anthropic',
            maskedPreview: '5678',
            readinessStatus: AiCredentialReadinessStatus.READY,
            lastVerifiedAt: null,
            lastVerificationCode: null,
            lastVerificationMessage: null,
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    renderCard();

    await user.click(screen.getByRole('button', { name: /delete credential/i }));

    expect(screen.getByText(/Delete AI Credential\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Future AI workflow launches that rely on this credential will be blocked/i)).toBeInTheDocument();
  });
});
