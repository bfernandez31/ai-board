import { AiCredentialProvider, AiCredentialType } from '@prisma/client';
import { z } from 'zod';

const providerToTypes: Record<AiCredentialProvider, AiCredentialType[]> = {
  [AiCredentialProvider.ANTHROPIC]: [
    AiCredentialType.ANTHROPIC_API_KEY,
    AiCredentialType.ANTHROPIC_OAUTH,
  ],
};

export const aiCredentialProviderSchema = z.nativeEnum(AiCredentialProvider);
export const aiCredentialTypeSchema = z.nativeEnum(AiCredentialType);

export const aiCredentialLabelSchema = z
  .string()
  .trim()
  .min(1, 'Label is required')
  .max(100, 'Label must be 100 characters or less');

export const aiCredentialSecretSchema = z
  .string()
  .trim()
  .min(1, 'Secret is required');

export const upsertAiCredentialBodySchema = z
  .object({
    credentialType: aiCredentialTypeSchema,
    label: aiCredentialLabelSchema,
    secret: aiCredentialSecretSchema,
  })
  .strict();

export const upsertAiCredentialSchema = z
  .object({
    provider: aiCredentialProviderSchema,
    credentialType: aiCredentialTypeSchema,
    label: aiCredentialLabelSchema,
    secret: aiCredentialSecretSchema,
  })
  .superRefine(({ provider, credentialType }, ctx) => {
    const supportedTypes = providerToTypes[provider];

    if (!supportedTypes.includes(credentialType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['credentialType'],
        message: 'Credential type is not supported for the selected provider',
      });
    }
  });

export const workflowCredentialRequestSchema = z
  .object({
    ticketId: z.number().int().positive().optional(),
    jobId: z.number().int().positive().optional(),
    command: z.enum([
      'specify',
      'plan',
      'implement',
      'verify',
      'ship',
      'quick-impl',
      'deploy-preview',
      'rollback-reset',
      'iterate',
      'comment-specify',
      'comment-plan',
      'comment-build',
      'comment-verify',
      'comment-ship',
      'health-scan',
    ]),
  })
  .strict();

export function isCredentialTypeSupportedForProvider(
  provider: AiCredentialProvider,
  credentialType: AiCredentialType
): boolean {
  return providerToTypes[provider].includes(credentialType);
}
