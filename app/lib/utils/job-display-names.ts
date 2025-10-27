/**
 * Job Display Name Mapping
 * Feature: 065-915-conversations-je
 *
 * Maps internal Job.command values to user-friendly display names
 * for conversation timeline rendering.
 */

/**
 * Explicit mapping table for known job commands
 * Provides user-friendly names that describe the job's purpose/output
 */
export const JOB_COMMAND_DISPLAY_NAMES: Record<string, string> = {
  // Normal workflow commands (FULL workflowType)
  'specify': 'Specification generation',
  'plan': 'Planning',
  'implement': 'Implementation',

  // Quick-impl workflow command (QUICK workflowType)
  'quick-impl': 'Quick implementation',

  // AI-BOARD assistance commands (comment-* pattern)
  'comment-specify': 'Specification assistance',
  'comment-plan': 'Planning assistance',
  'comment-build': 'Implementation assistance',
  'comment-verify': 'Verification assistance',

  // Legacy commands (if any)
  'clarify': 'Clarification (legacy)',
  'tasks': 'Task generation (legacy)',
} as const;

/**
 * Get user-friendly display name for a job command
 *
 * @param command - The job command string from Job.command
 * @returns User-friendly display name
 *
 * @example
 * getJobDisplayName('specify') // → "Specification generation"
 * getJobDisplayName('comment-plan') // → "Planning assistance"
 * getJobDisplayName('comment-ship') // → "Ship assistance" (fallback pattern)
 * getJobDisplayName('unknown-cmd') // → "Unknown command (unknown-cmd)"
 */
export function getJobDisplayName(command: string): string {
  // Handle empty/invalid commands
  if (!command || command.trim() === '') {
    return 'Unknown job type';
  }

  // Direct mapping lookup
  const displayName = JOB_COMMAND_DISPLAY_NAMES[command as keyof typeof JOB_COMMAND_DISPLAY_NAMES];
  if (displayName) {
    return displayName;
  }

  // Pattern-based fallback for unmapped comment-* commands
  if (command.startsWith('comment-')) {
    const stageSuffix = command.substring('comment-'.length);
    if (stageSuffix.length === 0) {
      return 'Unknown command (comment-)';
    }
    const stageCapitalized = stageSuffix.charAt(0).toUpperCase() + stageSuffix.slice(1).toLowerCase();
    return `${stageCapitalized} assistance`;
  }

  // Unknown commands: Return descriptive fallback
  return `Unknown command (${command})`;
}
