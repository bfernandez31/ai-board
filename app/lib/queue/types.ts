import { z } from 'zod';

// Job data schema
export const WorkflowJobDataSchema = z.object({
  ticketId: z.number(),
  projectId: z.number(),
  command: z.string(),
  ticketTitle: z.string(),
  ticketDescription: z.string(),
  branch: z.string().nullable(),
  githubOwner: z.string(),
  githubRepo: z.string(),
  jobId: z.number(),
});

export type WorkflowJobData = z.infer<typeof WorkflowJobDataSchema>;

// Job commands matching our stages
export type WorkflowCommand =
  | 'specify'
  | 'plan'
  | 'implement'
  | 'quick-impl'
  | 'comment-specify'
  | 'comment-plan'
  | 'comment-build'
  | 'comment-verify';

// Job status for tracking
export type QueueJobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';