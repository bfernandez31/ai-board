import { z } from 'zod';

export const commandPaletteQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, 'Query must be 100 characters or fewer')
    .default(''),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(20, 'Limit must be 20 or fewer')
    .default(10),
});

export type CommandPaletteQuery = z.infer<typeof commandPaletteQuerySchema>;
