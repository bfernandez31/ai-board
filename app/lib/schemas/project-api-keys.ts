import { z } from 'zod';

export const projectApiKeyProviderSchema = z.enum(['anthropic', 'openai']);

export const projectApiKeyUpdateSchema = z.object({
  provider: projectApiKeyProviderSchema,
  apiKey: z.string().trim().min(8).max(500),
});

export const projectApiKeyDeleteSchema = z.object({
  provider: projectApiKeyProviderSchema,
});

export const projectApiKeyTestSchema = z.object({
  provider: projectApiKeyProviderSchema,
  apiKey: z.string().trim().min(8).max(500).optional(),
});
