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

import type { Job, TokenSavingRunStatus } from '@prisma/client';

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

/**
 * TicketJobWithTelemetry Interface
 *
 * Extended job interface with full telemetry data for Stats tab display.
 * Used to type jobs passed to ticket-stats and jobs-timeline components.
 */
export interface TicketJobLogSummary {
  captureStatus: 'CAPTURED' | 'UNAVAILABLE' | 'PRUNED';
  preview: string;
}

export interface TicketJobWithTelemetry {
  id: number;
  command: string;
  status: string;
  branch: string | null;
  startedAt: Date | string;
  completedAt: Date | string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  model: string | null;
  toolsUsed: string[];
  qualityScore: number | null;
  qualityScoreDetails: string | null;
  peakContextTokens: number | null;
  avgContextTokens: number | null;
  turnCount: number | null;
  pluginVersion: string | null;
  agentCliVersion: string | null;
  tokenSavingRequested: boolean;
  tokenSavingStatus: TokenSavingRunStatus;
  tokenSavingFallbackReason: string | null;
  log: TicketJobLogSummary | null;
}
