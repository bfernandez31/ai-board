/**
 * RTL Component Tests: CredentialForm
 *
 * Tests for the credential form component.
 * Verifies form fields, provider/type selection, real-time format validation,
 * submit success, and submit error display.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { CredentialForm } from '@/components/credentials/credential-form';

const mockMutateAsync = vi.fn();
vi.mock('@/lib/hooks/mutations/useCredentials', () => ({
  useCreateCredential: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    error: null,
  })),
}));

import { useCreateCredential } from '@/lib/hooks/mutations/useCredentials';
const mockUseCreateCredential = vi.mocked(useCreateCredential);

describe('CredentialForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateCredential.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      error: null,
    } as ReturnType<typeof useCreateCredential>);
  });

  it('should render all form fields', () => {
    renderWithProviders(<CredentialForm />);

    expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/credential type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/label/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save credential/i })).toBeInTheDocument();
  });

  it('should show format validation error for invalid API key', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CredentialForm />);

    const valueInput = screen.getByLabelText(/api key/i);
    await user.type(valueInput, 'invalid-key');

    expect(screen.getByText(/api key must start with "sk-ant-api"/i)).toBeInTheDocument();
  });

  it('should show format validation error for short API key', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CredentialForm />);

    const valueInput = screen.getByLabelText(/api key/i);
    await user.type(valueInput, 'sk-ant-api03-short');

    expect(screen.getByText(/api key appears too short/i)).toBeInTheDocument();
  });

  it('should disable submit button when form is incomplete', () => {
    renderWithProviders(<CredentialForm />);

    const submitButton = screen.getByRole('button', { name: /save credential/i });
    expect(submitButton).toBeDisabled();
  });

  it('should call mutateAsync on valid submit', async () => {
    mockMutateAsync.mockResolvedValue({ id: 1 });
    const user = userEvent.setup();
    renderWithProviders(<CredentialForm />);

    const labelInput = screen.getByLabelText(/label/i);
    const valueInput = screen.getByLabelText(/api key/i);
    const validKey = 'sk-ant-api03-' + 'a'.repeat(80);

    await user.type(labelInput, 'Test Key');
    await user.type(valueInput, validKey);
    await user.click(screen.getByRole('button', { name: /save credential/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: 'Test Key',
        value: validKey,
      });
    });
  });

  it('should display error message on submit failure', async () => {
    mockUseCreateCredential.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      error: new Error('Credential validation failed: Invalid API key'),
    } as ReturnType<typeof useCreateCredential>);

    renderWithProviders(<CredentialForm />);

    expect(screen.getByText(/credential validation failed: invalid api key/i)).toBeInTheDocument();
  });

  it('should show loading state when submitting', () => {
    mockUseCreateCredential.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
      error: null,
    } as ReturnType<typeof useCreateCredential>);

    renderWithProviders(<CredentialForm />);

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });

  describe('OpenAI provider selection', () => {
    async function selectProvider(user: ReturnType<typeof userEvent.setup>, name: string) {
      const providerTrigger = screen.getByLabelText(/provider/i);
      await user.click(providerTrigger);
      // Radix Select may render option text in both trigger and listbox; use getAllByText and pick the option
      const matches = screen.getAllByText(name);
      await user.click(matches[matches.length - 1]);
    }

    it('should have provider selector enabled with ANTHROPIC and OPENAI options', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CredentialForm />);

      const providerTrigger = screen.getByLabelText(/provider/i);
      expect(providerTrigger).not.toBeDisabled();

      // Open the provider select
      await user.click(providerTrigger);

      expect(screen.getAllByText('Anthropic').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThanOrEqual(1);
    });

    it('should lock credential type to API_KEY when OPENAI is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CredentialForm />);

      await selectProvider(user, 'OpenAI');

      // Credential type should be disabled
      const typeTrigger = screen.getByLabelText(/credential type/i);
      expect(typeTrigger).toHaveAttribute('data-disabled');
    });

    it('should validate OpenAI API key format (sk- prefix)', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CredentialForm />);

      await selectProvider(user, 'OpenAI');

      const valueInput = screen.getByLabelText(/api key/i);
      await user.type(valueInput, 'invalid-key');

      expect(screen.getByText(/api key must start with "sk-"/i)).toBeInTheDocument();
    });

    it('should re-enable OAUTH_TOKEN when switching back to ANTHROPIC', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CredentialForm />);

      // Select OpenAI
      await selectProvider(user, 'OpenAI');

      // Switch back to Anthropic
      await selectProvider(user, 'Anthropic');

      // Credential type should be enabled
      const typeTrigger = screen.getByLabelText(/credential type/i);
      expect(typeTrigger).not.toHaveAttribute('data-disabled');

      // Open credential type selector and verify OAuth Token is available
      await user.click(typeTrigger);
      const oauthMatches = screen.getAllByText('OAuth Token');
      expect(oauthMatches.length).toBeGreaterThanOrEqual(1);
    });

    it('should submit with OPENAI provider', async () => {
      mockMutateAsync.mockResolvedValue({ id: 2 });
      const user = userEvent.setup();
      renderWithProviders(<CredentialForm />);

      await selectProvider(user, 'OpenAI');

      const labelInput = screen.getByLabelText(/label/i);
      const valueInput = screen.getByLabelText(/api key/i);
      const validKey = 'sk-proj-' + 'a'.repeat(40);

      await user.type(labelInput, 'My OpenAI Key');
      await user.type(valueInput, validKey);
      await user.click(screen.getByRole('button', { name: /save credential/i }));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          provider: 'OPENAI',
          credentialType: 'API_KEY',
          label: 'My OpenAI Key',
          value: validKey,
        });
      });
    });
  });
});
