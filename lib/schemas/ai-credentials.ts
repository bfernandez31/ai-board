import { z } from 'zod';

export const aiProviderSchema = z.enum(['ANTHROPIC', 'OPENAI']);

export const upsertProjectAiCredentialSchema = z.object({
  apiKey: z.string().trim().min(1, 'API key is required'),
});

export const aiCredentialProviderStatusSchema = z.object({
  provider: aiProviderSchema,
  status: z.enum(['NOT_CONFIGURED', 'CONFIGURED', 'INVALID']),
  validationStatus: z.enum(['PENDING', 'VALID', 'INVALID', 'ERROR']).nullable(),
  lastFour: z.string().length(4).nullable(),
  validatedAt: z.string().datetime().nullable(),
  message: z.string().nullable(),
  canManage: z.boolean(),
});

export const aiCredentialListResponseSchema = z.object({
  providers: z.array(aiCredentialProviderStatusSchema),
});

export const workflowProviderCredentialSchema = z.object({
  provider: aiProviderSchema,
  apiKey: z.string().min(1),
  lastFour: z.string().length(4),
  source: z.enum(['PROJECT_BYOK']),
});

export const workflowProviderCredentialListResponseSchema = z.object({
  credentials: z.array(workflowProviderCredentialSchema),
});
