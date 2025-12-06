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

/**
 * TicketJobWithStats Interface
 *
 * Extended job type with telemetry fields for Stats tab display.
 * Used when fetching jobs with `?includeStats=true` query parameter.
 */
export interface TicketJobWithStats {
  id: number;
  command: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedAt: string;
  completedAt: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  model: string | null;
  toolsUsed: string[];
}

/**
 * ToolUsageCount Interface
 *
 * Individual tool usage count for aggregated display.
 */
export interface ToolUsageCount {
  tool: string;
  count: number;
}

/**
 * TicketStats Interface
 *
 * Aggregated statistics computed from jobs for Stats tab display.
 */
export interface TicketStats {
  totalCost: number;
  totalDuration: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
  cacheEfficiency: number | null;
  toolUsage: ToolUsageCount[];
}
