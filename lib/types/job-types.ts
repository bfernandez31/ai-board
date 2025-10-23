/**
 * JobType Enum
 *
 * Represents the category of a job based on its command string.
 * - WORKFLOW: Automated stage transition jobs
 * - AI_BOARD: User-initiated AI assistance jobs via @ai-board mentions
 */
export enum JobType {
  WORKFLOW = 'WORKFLOW',
  AI_BOARD = 'AI_BOARD',
}

/**
 * Job Type Metadata
 *
 * Configuration for visual rendering of each job type.
 */
export interface JobTypeConfig {
  type: JobType;
  label: string;
  iconName: 'Cog' | 'MessageSquare';
  iconColor: string; // TailwindCSS class
  textColor: string; // TailwindCSS class
  bgColor: string; // TailwindCSS class
  ariaLabel: string; // Accessibility label template
}

/**
 * DualJobState Interface
 *
 * Represents the state of both job types (workflow and AI-BOARD) for a ticket.
 * Used to pass dual job information from Board to TicketCard components.
 */
export interface DualJobState {
  workflow: Job | null;
  aiBoard: Job | null;
}

// Job type imported from Prisma schema
import type { Job } from '@prisma/client';
