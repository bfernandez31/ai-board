/**
 * Zod validation schemas for Mini-Kanban demo data
 * Runtime validation for type safety
 */

import { z } from 'zod';

/**
 * Demo ticket validation schema
 */
export const DemoTicketSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(50),
  column: z.number().int().min(0).max(5),
});

/**
 * Workflow stage validation schema
 */
export const WorkflowStageSchema = z.object({
  index: z.number().int().min(0).max(5),
  name: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']),
  label: z.string().min(1).max(20),
  color: z.string().regex(/^bg-\w+-\d+$/), // Tailwind color class format
});

/**
 * Animation state validation schema
 */
export const AnimationStateSchema = z.object({
  tickets: z.array(DemoTicketSchema),
  isPaused: z.boolean(),
  isVisible: z.boolean(),
  prefersReducedMotion: z.boolean(),
});

/**
 * Inferred TypeScript types from Zod schemas
 */
export type DemoTicket = z.infer<typeof DemoTicketSchema>;
export type WorkflowStage = z.infer<typeof WorkflowStageSchema>;
export type AnimationState = z.infer<typeof AnimationStateSchema>;
