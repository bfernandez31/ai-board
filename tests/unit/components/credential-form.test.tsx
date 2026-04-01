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
});
