import {
  AiCredentialProvider,
  AiCredentialReadinessStatus,
  AiCredentialType,
} from '@prisma/client';
import { findProjectOwnerAiCredential } from '@/lib/db/ai-credentials';
import { resolveCredentialSecret } from '@/lib/ai-credentials/service';
import type {
  OwnerCredentialEligibility,
  WorkflowResolvedCredential,
} from '@/lib/ai-credentials/types';

export function getWorkflowAuthMode(credentialType: AiCredentialType): 'api-key' | 'oauth-token' {
  return credentialType === AiCredentialType.ANTHROPIC_API_KEY ? 'api-key' : 'oauth-token';
}

export async function getProjectOwnerCredentialEligibility(
  projectId: number,
  provider: AiCredentialProvider
): Promise<OwnerCredentialEligibility> {
  const result = await findProjectOwnerAiCredential(projectId, provider);

  if (!result?.credential) {
    return {
      eligible: false,
      code: 'OWNER_CREDENTIAL_MISSING',
      message: 'Project owner must configure a valid Anthropic credential in Settings.',
    };
  }

  if (result.credential.readinessStatus !== AiCredentialReadinessStatus.READY) {
    return {
      eligible: false,
      code: 'OWNER_CREDENTIAL_ACTION_REQUIRED',
      message:
        result.credential.lastVerificationMessage ??
        'Project owner must replace or re-verify the Anthropic credential before launching this workflow.',
    };
  }

  return {
    eligible: true,
    code: 'READY',
    message: 'Credential ready',
  };
}

export async function resolveProjectOwnerWorkflowCredential(
  projectId: number,
  provider: AiCredentialProvider
): Promise<WorkflowResolvedCredential | null> {
  const result = await findProjectOwnerAiCredential(projectId, provider);

  if (!result?.credential) {
    return null;
  }

  if (result.credential.readinessStatus !== AiCredentialReadinessStatus.READY) {
    return null;
  }

  const secret = await resolveCredentialSecret(result.credential);

  return {
    provider,
    credentialType: result.credential.credentialType,
    authMode: getWorkflowAuthMode(result.credential.credentialType),
    secret,
    ownerUserId: result.ownerUserId,
    resolvedAt: new Date().toISOString(),
  };
}
