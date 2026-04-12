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

  it('should validate Google API key format (AIza...)', () => {
    render(<CredentialForm />);
    
    // Select Google provider and API_KEY type
    const providerTrigger = screen.getByRole('combobox', { name: 'Provider' });
    fireEvent.mouseDown(providerTrigger);
    fireEvent.click(screen.getByText('Google'));
    
    // Enter invalid API key (missing AIza prefix)
    const valueInput = screen.getByLabelText('API Key');
    fireEvent.change(valueInput, { target: { value: 'invalid-key' } });
    
    // Should show format error
    expect(screen.getByText(/API key must start with "sk-ant-api"/)).toBeInTheDocument();
    
    // Enter valid API key
    fireEvent.change(valueInput, { target: { value: 'sk-ant-api' + 'a'.repeat(50) } });
    
    // Should not show format error
    expect(screen.queryByText(/API key must start with "sk-ant-api"/)).not.toBeInTheDocument();
  });

  it('should validate Google OAuth token format (20+ chars)', () => {
    render(<CredentialForm />);
    
    // Select Google provider and OAUTH_TOKEN type
    const providerTrigger = screen.getByRole('combobox', { name: 'Provider' });
    fireEvent.mouseDown(providerTrigger);
    fireEvent.click(screen.getByText('Google'));
    
    const typeTrigger = screen.getByRole('combobox', { name: 'Credential Type' });
    fireEvent.mouseDown(typeTrigger);
    fireEvent.click(screen.getByText('OAuth Token'));
    
    // Enter invalid OAuth token (too short)
    const valueInput = screen.getByLabelText('API Key');
    fireEvent.change(valueInput, { target: { value: 'short-token' } });
    
    // Should show format error
    expect(screen.getByText(/API key must start with "sk-ant-api"/)).toBeInTheDocument();
    
    // Enter valid API key
    fireEvent.change(valueInput, { target: { value: 'sk-ant-api' + 'a'.repeat(50) } });
    
    // Should not show format error
    expect(screen.queryByText(/API key must start with "sk-ant-api"/)).not.toBeInTheDocument();
  });

  it('should show appropriate placeholder for Google API key', () => {
    render(<CredentialForm />);
    
    // Select Google provider
    const providerTrigger = screen.getByRole('combobox', { name: 'Provider' });
    fireEvent.mouseDown(providerTrigger);
    fireEvent.click(screen.getByText('Google'));
    
    // Check placeholder
    const valueInput = screen.getByLabelText('API Key');
    expect(valueInput).toHaveAttribute('placeholder', expect.stringContaining('sk-ant-api'));
  });

  it('should show appropriate placeholder for Google OAuth token', () => {
    render(<CredentialForm />);
    
    // Select Google provider and OAUTH_TOKEN type
    const providerTrigger = screen.getByRole('combobox', { name: 'Provider' });
    fireEvent.mouseDown(providerTrigger);
    fireEvent.click(screen.getByText('Google'));
    
    const typeTrigger = screen.getByRole('combobox', { name: 'Credential Type' });
    fireEvent.mouseDown(typeTrigger);
    fireEvent.click(screen.getByText('OAuth Token'));
    
    // Check placeholder
    const valueInput = screen.getByLabelText('API Key');
    expect(valueInput).toHaveAttribute('placeholder', expect.stringContaining('sk-ant-api'));
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
