import { z } from 'zod';

export const AnalysisInputSnapshotSchema = z
  .object({
    titleSnapshot: z.string().min(1).max(100),
    descriptionSnapshot: z.string().max(10_000),
  })
  .strict();
export type AnalysisInputSnapshot = z.infer<typeof AnalysisInputSnapshotSchema>;
