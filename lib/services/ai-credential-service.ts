import {
  AiCredentialValidationStatus,
  AiProvider,
  type Prisma,
  WorkflowCredentialSource,
} from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { decryptProjectCredential, encryptProjectCredential } from '@/lib/security/project-ai-credentials';
import { validateProviderApiKey } from '@/lib/services/ai-provider-validation';
import { AI_PROVIDERS, type ProviderStatusView, type WorkflowProviderCredential, type WorkflowProviderRequirementFailure } from '@/lib/types/ai-credentials';

type CredentialRecord = Prisma.ProjectAiCredentialGetPayload<{
  select: {
    id: true;
    projectId: true;
    provider: true;
    encryptedKey: true;
    encryptionIv: true;
    encryptionTag: true;
    lastFour: true;
    validationStatus: true;
    validationMessage: true;
    validatedAt: true;
  };
}>;

function deriveProviderStatus(
  credential: CredentialRecord | null,
  canManage: boolean
): ProviderStatusView {
  if (!credential) {
    return {
      provider: canManage ? AiProvider.ANTHROPIC : AiProvider.ANTHROPIC,
      status: 'NOT_CONFIGURED',
      validationStatus: null,
      lastFour: null,
      validatedAt: null,
      message: null,
      canManage,
    };
  }

  return {
    provider: credential.provider,
    status:
      credential.validationStatus === AiCredentialValidationStatus.INVALID ||
      credential.validationStatus === AiCredentialValidationStatus.ERROR
        ? 'INVALID'
        : 'CONFIGURED',
    validationStatus: credential.validationStatus,
    lastFour: canManage ? credential.lastFour : null,
    validatedAt: credential.validatedAt?.toISOString() ?? null,
    message: credential.validationMessage,
    canManage,
  };
}

function selectCredentialFields() {
  return {
    id: true,
    projectId: true,
    provider: true,
    encryptedKey: true,
    encryptionIv: true,
    encryptionTag: true,
    lastFour: true,
    validationStatus: true,
    validationMessage: true,
    validatedAt: true,
  } satisfies Prisma.ProjectAiCredentialSelect;
}

export async function listProjectAiCredentials(
  projectId: number,
  canManage: boolean
): Promise<ProviderStatusView[]> {
  const credentials = await prisma.projectAiCredential.findMany({
    where: { projectId },
    select: selectCredentialFields(),
  });

  const byProvider = new Map(credentials.map((credential) => [credential.provider, credential]));

  return AI_PROVIDERS.map((provider) => {
    const credential = byProvider.get(provider) ?? null;
    if (!credential) {
      return {
        provider,
        status: 'NOT_CONFIGURED',
        validationStatus: null,
        lastFour: null,
        validatedAt: null,
        message: null,
        canManage,
      };
    }

    return deriveProviderStatus(credential, canManage);
  });
}

export async function upsertProjectAiCredential(
  projectId: number,
  provider: AiProvider,
  apiKey: string,
  userId: string
): Promise<ProviderStatusView> {
  const encrypted = encryptProjectCredential(apiKey);
  const validation = await validateProviderApiKey(provider, apiKey);

  const credential = await prisma.projectAiCredential.upsert({
    where: {
      projectId_provider: {
        projectId,
        provider,
      },
    },
    update: {
      ...encrypted,
      validationStatus: validation.validationStatus,
      validationMessage: validation.message,
      validatedAt: new Date(validation.validatedAt),
      updatedByUserId: userId,
    },
    create: {
      projectId,
      provider,
      ...encrypted,
      validationStatus: validation.validationStatus,
      validationMessage: validation.message,
      validatedAt: new Date(validation.validatedAt),
      createdByUserId: userId,
      updatedByUserId: userId,
    },
    select: selectCredentialFields(),
  });

  return deriveProviderStatus(credential, true);
}

export async function revalidateProjectAiCredential(
  projectId: number,
  provider: AiProvider
): Promise<ProviderStatusView | null> {
  const existing = await prisma.projectAiCredential.findUnique({
    where: {
      projectId_provider: {
        projectId,
        provider,
      },
    },
    select: selectCredentialFields(),
  });

  if (!existing) {
    return null;
  }

  const apiKey = decryptProjectCredential(existing);
  const validation = await validateProviderApiKey(provider, apiKey);
  const updated = await prisma.projectAiCredential.update({
    where: { id: existing.id },
    data: {
      validationStatus: validation.validationStatus,
      validationMessage: validation.message,
      validatedAt: new Date(validation.validatedAt),
    },
    select: selectCredentialFields(),
  });

  return deriveProviderStatus(updated, true);
}

export async function deleteProjectAiCredential(
  projectId: number,
  provider: AiProvider
): Promise<boolean> {
  const deleted = await prisma.projectAiCredential.deleteMany({
    where: { projectId, provider },
  });

  return deleted.count > 0;
}

export async function getCredentialReadinessFailures(
  projectId: number,
  providers: AiProvider[]
): Promise<WorkflowProviderRequirementFailure[]> {
  const credentials = await prisma.projectAiCredential.findMany({
    where: {
      projectId,
      provider: {
        in: providers,
      },
    },
    select: selectCredentialFields(),
  });

  const byProvider = new Map(credentials.map((credential) => [credential.provider, credential]));

  const failures: WorkflowProviderRequirementFailure[] = [];

  for (const provider of providers) {
    const credential = byProvider.get(provider);
    if (!credential) {
      failures.push({
        provider,
        reason: 'MISSING',
        validationStatus: null,
        message: `${provider} credentials are not configured for this project.`,
      });
      continue;
    }

    if (
      credential.validationStatus === AiCredentialValidationStatus.INVALID ||
      credential.validationStatus === AiCredentialValidationStatus.ERROR
    ) {
      failures.push({
        provider,
        reason: 'INVALID',
        validationStatus: credential.validationStatus,
        message: credential.validationMessage ?? `${provider} credentials must be revalidated before launch.`,
      });
    }
  }

  return failures;
}

export async function createJobCredentialSnapshots(
  tx: Prisma.TransactionClient,
  projectId: number,
  jobId: number,
  providers: AiProvider[]
): Promise<void> {
  const credentials = await tx.projectAiCredential.findMany({
    where: {
      projectId,
      provider: { in: providers },
    },
  });

  if (credentials.length !== providers.length) {
    throw new Error('Required provider credentials are missing');
  }

  await tx.jobAiCredentialSnapshot.createMany({
    data: credentials.map((credential) => ({
      jobId,
      projectId,
      provider: credential.provider,
      source: WorkflowCredentialSource.PROJECT_BYOK,
      projectAiCredentialId: credential.id,
      encryptedKey: credential.encryptedKey,
      encryptionIv: credential.encryptionIv,
      encryptionTag: credential.encryptionTag,
      lastFour: credential.lastFour,
    })),
  });
}

export async function getWorkflowProviderCredentials(
  projectId: number,
  jobId: number
): Promise<WorkflowProviderCredential[]> {
  const snapshots = await prisma.jobAiCredentialSnapshot.findMany({
    where: {
      projectId,
      jobId,
    },
    orderBy: { id: 'asc' },
  });

  return snapshots.map((snapshot) => ({
    provider: snapshot.provider,
    apiKey: decryptProjectCredential(snapshot),
    lastFour: snapshot.lastFour,
    source: snapshot.source,
  }));
}
