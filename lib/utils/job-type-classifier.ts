import { JobType, JobTypeConfig } from '@/lib/types/job-types';

/**
 * Job Type Configuration Map
 */
export const JOB_TYPE_CONFIG: Record<JobType, JobTypeConfig> = {
  [JobType.WORKFLOW]: {
    type: JobType.WORKFLOW,
    label: 'Workflow',
    iconName: 'Cog',
    iconColor: 'text-blue-600',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-100/10',
    ariaLabel: 'Automated workflow job',
  },
  [JobType.AI_BOARD]: {
    type: JobType.AI_BOARD,
    label: 'AI-BOARD',
    iconName: 'MessageSquare',
    iconColor: 'text-purple-600',
    textColor: 'text-purple-600',
    bgColor: 'bg-purple-100/10',
    ariaLabel: 'AI-BOARD assistance job',
  },
  [JobType.DEPLOY]: {
    type: JobType.DEPLOY,
    label: 'Deploy',
    iconName: 'Rocket',
    iconColor: 'text-blue-600',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-100/10',
    ariaLabel: 'Vercel preview deployment job',
  },
};

/**
 * Classify Job Type
 *
 * Derives JobType from command string using prefix pattern matching.
 *
 * Rules:
 * - Commands starting with "comment-" → AI_BOARD
 * - Command "deploy-preview" → DEPLOY
 * - All other commands → WORKFLOW (conservative default)
 *
 * @param command - Job command string from database
 * @returns JobType enum value
 *
 * @example
 * classifyJobType('specify') // → JobType.WORKFLOW
 * classifyJobType('comment-specify') // → JobType.AI_BOARD
 * classifyJobType('deploy-preview') // → JobType.DEPLOY
 * classifyJobType('quick-impl') // → JobType.WORKFLOW
 * classifyJobType('comment-build') // → JobType.AI_BOARD
 */
export function classifyJobType(command: string): JobType {
  if (command.startsWith('comment-')) {
    return JobType.AI_BOARD;
  }
  if (command === 'deploy-preview') {
    return JobType.DEPLOY;
  }
  return JobType.WORKFLOW;
}

/**
 * Get Job Type Configuration
 *
 * Retrieves visual configuration for a given JobType.
 *
 * @param jobType - JobType enum value
 * @returns JobTypeConfig object
 *
 * @example
 * const config = getJobTypeConfig(JobType.WORKFLOW);
 * console.log(config.label); // "Workflow"
 * console.log(config.iconColor); // "text-blue-600"
 */
export function getJobTypeConfig(jobType: JobType): JobTypeConfig {
  return JOB_TYPE_CONFIG[jobType];
}
