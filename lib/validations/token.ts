import { z } from 'zod';

/**
 * Validation schema for creating a new personal access token
 */
export const createTokenSchema = z.object({
  name: z
    .string()
    .min(1, 'Token name is required')
    .max(50, 'Token name must be 50 characters or less')
    .trim(),
});

export type CreateTokenInput = z.infer<typeof createTokenSchema>;
