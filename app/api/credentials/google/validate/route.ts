import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { getCurrentUserOrToken } from '@/lib/db/users';
import { getProviderModule } from '@/lib/ai-credentials/providers';

const validateGoogleCredentialSchema = z.object({
  credentialType: z.enum(['API_KEY', 'OAUTH_TOKEN']),
  value: z.string().min(1, 'Credential value is required'),
});

/**
 * Validate Google credential format and connectivity
 */
export async function POST(request: NextRequest) {
  try {
    await getCurrentUserOrToken(request); // Ensure user is authenticated
    
    const body = await request.json();
    const { credentialType, value } = validateGoogleCredentialSchema.parse(body);
    
    const providerModule = getProviderModule('GOOGLE');
    
    // Validate format first
    const formatResult = providerModule.validateFormat(credentialType, value);
    if (!formatResult.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: formatResult.error,
          verificationCode: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }
    
    // If format is valid, attempt provider verification
    const verificationResult = await providerModule.verifyWithProvider(credentialType, value);
    
    return NextResponse.json({
      valid: verificationResult.verificationCode === 'VALID',
      readinessStatus: verificationResult.readinessStatus,
      verificationCode: verificationResult.verificationCode,
      verificationMessage: verificationResult.verificationMessage,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message || 'Invalid input' },
        { status: 400 }
      );
    }
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Google credential validation failed:', error);
    return NextResponse.json(
      { error: 'Failed to validate Google credential' },
      { status: 500 }
    );
  }
}
