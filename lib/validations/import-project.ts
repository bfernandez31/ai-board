import { z } from 'zod';

export const importProjectSchema = z.object({
  githubOwner: z
    .string()
    .min(1, 'GitHub owner is required')
    .max(100, 'GitHub owner must be 100 characters or less'),
  githubRepo: z
    .string()
    .min(1, 'GitHub repo is required')
    .max(100, 'GitHub repo must be 100 characters or less'),
  name: z
    .string()
    .min(1)
    .max(100, 'Project name must be 100 characters or less')
    .optional(),
  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional(),
});

export type ImportProjectInput = z.infer<typeof importProjectSchema>;
