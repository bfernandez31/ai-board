import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CredentialForm } from '@/components/credentials/credential-form';
import { useCreateCredential } from '@/lib/hooks/mutations/useCredentials';

// Mock the useCreateCredential hook
vi.mock('@/lib/hooks/mutations/useCredentials', () => ({
  useCreateCredential: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  })),
}));

describe('CredentialForm - Google Support', () => {
  it('should include Google as a provider option', () => {
    render(<CredentialForm />);
    
    // Open the provider dropdown
    const providerTrigger = screen.getByRole('combobox', { name: 'Provider' });
    fireEvent.mouseDown(providerTrigger);
    
    // Check that Google is available as an option
    expect(screen.getByText('Google')).toBeInTheDocument();
  });

  it('should allow selecting Google provider', () => {
    render(<CredentialForm />);
    
    // Open the provider dropdown
    const providerTrigger = screen.getByRole('combobox', { name: 'Provider' });
    fireEvent.mouseDown(providerTrigger);
    
    // Select Google
    const googleOption = screen.getByText('Google');
    fireEvent.click(googleOption);
    
    // Verify Google is selected
    expect(screen.getByText('Google')).toBeInTheDocument();
  });

  it('should support both API_KEY and OAUTH_TOKEN for Google', () => {
    render(<CredentialForm />);
    
    // Select Google provider
    const providerTrigger = screen.getByRole('combobox', { name: 'Provider' });
    fireEvent.mouseDown(providerTrigger);
    fireEvent.click(screen.getByText('Google'));
    
    // Open credential type dropdown
    const typeTrigger = screen.getByRole('combobox', { name: 'Credential Type' });
    fireEvent.mouseDown(typeTrigger);
    
    // Both API_KEY and OAUTH_TOKEN should be available
    const apiKeyOption = screen.getAllByText('API Key')[1];
    const oauthOption = screen.getByText('OAuth Token');
    expect(apiKeyOption).toBeInTheDocument();
    expect(oauthOption).toBeInTheDocument();
  });

  it('should validate Google API key format (AIza...)', async () => {
    render(<CredentialForm />);
    
    // Find the hidden select element and change its value
    const hiddenSelect = screen.getByRole('combobox', { name: 'Provider' }).nextElementSibling as HTMLSelectElement;
    fireEvent.change(hiddenSelect, { target: { value: 'GOOGLE' } });
    
    // Wait for provider change to take effect
    await waitFor(() => {
      // Enter invalid API key (missing AIza prefix)
      const valueInput = screen.getByLabelText('API Key');
      fireEvent.change(valueInput, { target: { value: 'invalid-key' } });
      
      // Should show format error for Google API key
      expect(screen.getByText(/API key must start with "AIza"/)).toBeInTheDocument();
    });
    
    // Enter valid API key
    const valueInput = screen.getByLabelText('API Key');
    fireEvent.change(valueInput, { target: { value: 'AIza' + 'a'.repeat(50) } });
    
    // Should not show format error
    await waitFor(() => {
      expect(screen.queryByText(/API key must start with "AIza"/)).not.toBeInTheDocument();
    });
  });

  it('should validate Google OAuth token format (20+ chars)', async () => {
    render(<CredentialForm />);
    
    // Find the hidden select elements and change their values
    const providerHiddenSelect = screen.getByRole('combobox', { name: 'Provider' }).nextElementSibling as HTMLSelectElement;
    fireEvent.change(providerHiddenSelect, { target: { value: 'GOOGLE' } });
    
    const typeHiddenSelect = screen.getByRole('combobox', { name: 'Credential Type' }).nextElementSibling as HTMLSelectElement;
    fireEvent.change(typeHiddenSelect, { target: { value: 'OAUTH_TOKEN' } });
    
    // Wait for type change to take effect
    await waitFor(() => {
      // Enter invalid OAuth token (too short)
      const valueInput = screen.getByLabelText('OAuth Token');
      fireEvent.change(valueInput, { target: { value: 'short-token' } });
      
      // Should show format error for OAuth token length
      expect(screen.getByText(/OAuth token must be at least 20 characters/)).toBeInTheDocument();
    });
    
    // Enter valid OAuth token
    const valueInput = screen.getByLabelText('OAuth Token');
    fireEvent.change(valueInput, { target: { value: 'valid-oauth-token-1234567890' } });
    
    // Should not show format error
    await waitFor(() => {
      expect(screen.queryByText(/OAuth token must be at least 20 characters/)).not.toBeInTheDocument();
    });
  });

  it('should show appropriate placeholder for Google API key', async () => {
    render(<CredentialForm />);
    
    // Find the hidden select element and change its value
    const hiddenSelect = screen.getByRole('combobox', { name: 'Provider' }).nextElementSibling as HTMLSelectElement;
    fireEvent.change(hiddenSelect, { target: { value: 'GOOGLE' } });
    
    // Wait for provider change to take effect and check placeholder
    await waitFor(() => {
      const valueInput = screen.getByLabelText('API Key');
      expect(valueInput).toHaveAttribute('placeholder', expect.stringContaining('AIza'));
    });
  });

  it('should show appropriate placeholder for Google OAuth token', async () => {
    render(<CredentialForm />);
    
    // Find the hidden select elements and change their values
    const providerHiddenSelect = screen.getByRole('combobox', { name: 'Provider' }).nextElementSibling as HTMLSelectElement;
    fireEvent.change(providerHiddenSelect, { target: { value: 'GOOGLE' } });
    
    const typeHiddenSelect = screen.getByRole('combobox', { name: 'Credential Type' }).nextElementSibling as HTMLSelectElement;
    fireEvent.change(typeHiddenSelect, { target: { value: 'OAUTH_TOKEN' } });
    
    // Wait for type change to take effect and check placeholder
    await waitFor(() => {
      const valueInput = screen.getByLabelText('OAuth Token');
      expect(valueInput).toHaveAttribute('placeholder', expect.stringContaining('OAuth token'));
    });
  });

  it('should submit Google credential successfully', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useCreateCredential).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      error: null,
    });
    
    render(<CredentialForm />);
    
    // Fill out the form
    const labelInput = screen.getByLabelText('Label');
    fireEvent.change(labelInput, { target: { value: 'Production Google Key' } });
    
    const providerTrigger = screen.getByRole('combobox', { name: 'Provider' });
    fireEvent.mouseDown(providerTrigger);
    fireEvent.click(screen.getByText('Google'));
    
    const valueInput = screen.getByLabelText('API Key');
    fireEvent.change(valueInput, { target: { value: 'sk-ant-api' + 'a'.repeat(90) } });
    
    // Submit
    const submitButton = screen.getByText('Save Credential');
    fireEvent.click(submitButton);
    
    // Wait for submission
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
  });
});
