/**
 * JobType Enum
 *
 * Represents the category of a job based on its command string.
 * - WORKFLOW: Automated stage transition jobs
 * - AI_BOARD: User-initiated AI assistance jobs via @ai-board mentions
 * - DEPLOY: Vercel preview deployment jobs
 */
export enum JobType {
  WORKFLOW = 'WORKFLOW',
  AI_BOARD = 'AI_BOARD',
  DEPLOY = 'DEPLOY',
}

/**
 * Job Type Metadata
 *
 * Configuration for visual rendering of each job type.
 */
export interface JobTypeConfig {
  type: JobType;
  label: string;
  iconName: 'Cog' | 'MessageSquare' | 'Rocket';
  iconColor: string; // TailwindCSS class
  textColor: string; // TailwindCSS class
  bgColor: string; // TailwindCSS class
  ariaLabel: string; // Accessibility label template
}

/**
 * DualJobState Interface
 *
 * Represents the state of job types (workflow, AI-BOARD, and deploy) for a ticket.
 * Used to pass job information from Board to TicketCard components.
 */
export interface DualJobState {
  workflow: Job | null;
  aiBoard: Job | null;
  deployJob: Job | null;
}

// Job type imported from Prisma schema
import type { Job } from '@prisma/client';
