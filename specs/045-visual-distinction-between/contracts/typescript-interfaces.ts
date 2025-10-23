/**
 * TypeScript Interface Contracts
 * Feature: Visual Job Type Distinction
 *
 * This file defines all TypeScript interfaces, types, and enums required
 * for the job type visual distinction feature.
 */

import { JobStatus } from '@prisma/client';

// ============================================================================
// Core Types
// ============================================================================

/**
 * JobType Enum
 *
 * Represents the category of a job based on its command string.
 *
 * Values:
 * - WORKFLOW: Automated stage transition jobs (specify, plan, tasks, implement, quick-impl)
 * - AI_BOARD: User-initiated AI assistance jobs via @ai-board mentions (comment-*)
 *
 * Source: Derived from Job.command field (database VARCHAR(50))
 *
 * @example
 * const type = classifyJobType('specify'); // JobType.WORKFLOW
 * const type = classifyJobType('comment-plan'); // JobType.AI_BOARD
 */
export enum JobType {
  WORKFLOW = 'WORKFLOW',
  AI_BOARD = 'AI_BOARD',
}

/**
 * Job Type Configuration
 *
 * Visual rendering configuration for each job type.
 *
 * Fields:
 * - type: JobType enum value
 * - label: Human-readable text label for display
 * - iconName: lucide-react icon component name
 * - iconColor: TailwindCSS utility class for icon color
 * - textColor: TailwindCSS utility class for text color
 * - bgColor: TailwindCSS utility class for background color (optional)
 * - ariaLabel: Accessibility label template for screen readers
 *
 * @example
 * const config = getJobTypeConfig(JobType.WORKFLOW);
 * console.log(config.label); // "Workflow"
 * console.log(config.iconColor); // "text-blue-600"
 */
export interface JobTypeConfig {
  type: JobType;
  label: string;
  iconName: 'Cog' | 'MessageSquare';
  iconColor: string;
  textColor: string;
  bgColor: string;
  ariaLabel: string;
}

// ============================================================================
// Component Interfaces
// ============================================================================

/**
 * Enhanced JobStatusIndicator Props
 *
 * Props interface for JobStatusIndicator component with optional job type support.
 *
 * New in this feature:
 * - jobType?: Optional prop for visual job type distinction
 *
 * Existing props (unchanged):
 * - status: Current job status (PENDING, RUNNING, etc.)
 * - command: Job command string for context
 * - className?: Optional CSS class name
 * - animated?: Whether to show animation for RUNNING status
 * - ariaLabel?: Custom accessibility label
 *
 * Backward Compatibility:
 * - jobType is optional, so existing usage continues to work
 * - If jobType is undefined, no job type indicator is rendered
 *
 * @example
 * // Without job type (existing behavior)
 * <JobStatusIndicator status="RUNNING" command="specify" />
 *
 * // With job type (new behavior)
 * <JobStatusIndicator
 *   status="RUNNING"
 *   command="specify"
 *   jobType={JobType.WORKFLOW}
 * />
 */
export interface JobStatusIndicatorProps {
  /**
   * Current job status
   * Required, must be valid JobStatus enum value
   */
  status: JobStatus;

  /**
   * Job command string (e.g., "specify", "comment-plan")
   * Required, used for context and accessibility labels
   */
  command: string;

  /**
   * Optional: Job type for visual distinction
   * If not provided, no job type indicator is rendered
   * If provided, must be valid JobType enum value
   */
  jobType?: JobType;

  /**
   * Optional: CSS class name for styling
   * Applied to root container div
   */
  className?: string;

  /**
   * Whether to show animation (for RUNNING status)
   * Defaults to true if not specified
   * Animation uses GPU-accelerated transforms
   */
  animated?: boolean;

  /**
   * Accessibility label for screen readers
   * Defaults to auto-generated label if not provided
   */
  ariaLabel?: string;
}

// ============================================================================
// Utility Function Signatures
// ============================================================================

/**
 * Classify Job Type Function Signature
 *
 * Derives JobType from Job.command string using prefix-based pattern matching.
 *
 * Rules:
 * - Commands starting with "comment-" → AI_BOARD
 * - All other commands → WORKFLOW (conservative default)
 *
 * Performance:
 * - O(1) time complexity (simple string prefix check)
 * - No regex parsing required
 * - Suitable for high-frequency calls (every job status update)
 *
 * Edge Cases:
 * - Empty string "" → JobType.WORKFLOW (default)
 * - Unknown future commands → JobType.WORKFLOW (safe default)
 * - Case sensitivity → Assumes lowercase commands (current convention)
 *
 * @param command - Job command string from database (Job.command field)
 * @returns JobType enum value (WORKFLOW or AI_BOARD)
 *
 * @example
 * classifyJobType('specify') // → JobType.WORKFLOW
 * classifyJobType('comment-specify') // → JobType.AI_BOARD
 * classifyJobType('quick-impl') // → JobType.WORKFLOW
 * classifyJobType('comment-build') // → JobType.AI_BOARD
 * classifyJobType('') // → JobType.WORKFLOW (default)
 * classifyJobType('unknown-command') // → JobType.WORKFLOW (safe default)
 */
export type ClassifyJobTypeFunction = (command: string) => JobType;

/**
 * Get Job Type Config Function Signature
 *
 * Retrieves visual configuration for a given JobType.
 *
 * Returns:
 * - JobTypeConfig object with all visual rendering properties
 * - Configuration includes icon, colors, labels, and accessibility text
 *
 * Performance:
 * - O(1) lookup in static configuration object
 * - No computation required
 *
 * @param jobType - JobType enum value (WORKFLOW or AI_BOARD)
 * @returns JobTypeConfig object with visual rendering properties
 *
 * @example
 * const config = getJobTypeConfig(JobType.WORKFLOW);
 * console.log(config.label); // "Workflow"
 * console.log(config.iconName); // "Cog"
 * console.log(config.iconColor); // "text-blue-600"
 * console.log(config.ariaLabel); // "Automated workflow job"
 */
export type GetJobTypeConfigFunction = (jobType: JobType) => JobTypeConfig;

// ============================================================================
// Configuration Constants Type
// ============================================================================

/**
 * Job Type Configuration Map Type
 *
 * Type definition for the static configuration object mapping JobType to JobTypeConfig.
 *
 * Structure:
 * - Key: JobType enum value
 * - Value: JobTypeConfig object
 *
 * Validation:
 * - All JobType values must have corresponding JobTypeConfig
 * - Icon names must match lucide-react exports
 * - Colors must be valid TailwindCSS classes
 * - Contrast ratios must meet WCAG 2.1 AA (4.5:1 minimum)
 *
 * @example
 * const JOB_TYPE_CONFIG: JobTypeConfigMap = {
 *   [JobType.WORKFLOW]: {
 *     type: JobType.WORKFLOW,
 *     label: 'Workflow',
 *     iconName: 'Cog',
 *     iconColor: 'text-blue-600',
 *     textColor: 'text-blue-600',
 *     bgColor: 'bg-blue-100/10',
 *     ariaLabel: 'Automated workflow job',
 *   },
 *   [JobType.AI_BOARD]: {
 *     type: JobType.AI_BOARD,
 *     label: 'AI-BOARD',
 *     iconName: 'MessageSquare',
 *     iconColor: 'text-purple-600',
 *     textColor: 'text-purple-600',
 *     bgColor: 'bg-purple-100/10',
 *     ariaLabel: 'AI-BOARD assistance job',
 *   },
 * };
 */
export type JobTypeConfigMap = Record<JobType, JobTypeConfig>;

// ============================================================================
// Known Command Values (for reference and testing)
// ============================================================================

/**
 * Workflow Command Values
 *
 * Known command strings that classify as WORKFLOW jobs.
 * Used for type safety and test case generation.
 */
export const WORKFLOW_COMMANDS = [
  'specify',
  'plan',
  'tasks',
  'implement',
  'quick-impl',
] as const;

/**
 * AI-BOARD Command Values
 *
 * Known command strings that classify as AI_BOARD jobs.
 * Used for type safety and test case generation.
 */
export const AI_BOARD_COMMANDS = [
  'comment-specify',
  'comment-plan',
  'comment-build',
  'comment-verify',
] as const;

/**
 * Workflow Command Type
 *
 * Union type of all known workflow commands.
 * Useful for type guards and validation.
 */
export type WorkflowCommand = typeof WORKFLOW_COMMANDS[number];

/**
 * AI-BOARD Command Type
 *
 * Union type of all known AI-BOARD commands.
 * Useful for type guards and validation.
 */
export type AIBoardCommand = typeof AI_BOARD_COMMANDS[number];

/**
 * All Known Commands Type
 *
 * Union type of all known command strings.
 * Useful for exhaustive testing and type narrowing.
 */
export type KnownCommand = WorkflowCommand | AIBoardCommand;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type Guard: Is Workflow Command
 *
 * Checks if a command string is a known workflow command.
 *
 * @param command - Command string to check
 * @returns true if command is in WORKFLOW_COMMANDS array
 *
 * @example
 * isWorkflowCommand('specify') // → true
 * isWorkflowCommand('comment-plan') // → false
 * isWorkflowCommand('unknown') // → false
 */
export function isWorkflowCommand(command: string): command is WorkflowCommand {
  return (WORKFLOW_COMMANDS as readonly string[]).includes(command);
}

/**
 * Type Guard: Is AI-BOARD Command
 *
 * Checks if a command string is a known AI-BOARD command.
 *
 * @param command - Command string to check
 * @returns true if command is in AI_BOARD_COMMANDS array
 *
 * @example
 * isAIBoardCommand('comment-plan') // → true
 * isAIBoardCommand('specify') // → false
 * isAIBoardCommand('unknown') // → false
 */
export function isAIBoardCommand(command: string): command is AIBoardCommand {
  return (AI_BOARD_COMMANDS as readonly string[]).includes(command);
}

/**
 * Type Guard: Is Known Command
 *
 * Checks if a command string is a known command (workflow or AI-BOARD).
 *
 * @param command - Command string to check
 * @returns true if command is in WORKFLOW_COMMANDS or AI_BOARD_COMMANDS
 *
 * @example
 * isKnownCommand('specify') // → true
 * isKnownCommand('comment-plan') // → true
 * isKnownCommand('unknown') // → false
 */
export function isKnownCommand(command: string): command is KnownCommand {
  return isWorkflowCommand(command) || isAIBoardCommand(command);
}
