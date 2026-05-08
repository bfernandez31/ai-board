import { z } from 'zod';

export const jobVersionsUpdateSchema = z
  .object({
    pluginVersion: z.string().trim().min(1).max(100).optional(),
    agentCliVersion: z.string().trim().min(1).max(100).optional(),
  })
  .refine(
    (data) => data.pluginVersion !== undefined || data.agentCliVersion !== undefined,
    {
      message: 'At least one of pluginVersion or agentCliVersion must be provided',
    }
  );

export type JobVersionsUpdate = z.infer<typeof jobVersionsUpdateSchema>;
