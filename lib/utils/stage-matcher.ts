import type { Stage } from '@/lib/validations/ticket';

/**
 * T020: matchesStage - Stage matching utility for AI-BOARD jobs
 *
 * Determines if an AI-BOARD job command matches the current ticket stage.
 * Used for stage-filtered visibility (e.g., "comment-specify" visible only in SPECIFY stage).
 *
 * @param command - Job command (e.g., "comment-specify", "comment-plan")
 * @param currentStage - Current ticket stage (e.g., "SPECIFY", "PLAN", "BUILD")
 * @returns true if command suffix matches current stage (case-insensitive), false otherwise
 *
 * @example
 * matchesStage('comment-specify', 'SPECIFY') // => true
 * matchesStage('comment-specify', 'PLAN')    // => false
 * matchesStage('specify', 'SPECIFY')         // => false (not a comment command)
 * matchesStage('comment-SPECIFY', 'SPECIFY') // => true (case-insensitive)
 */
export function matchesStage(command: string, currentStage: Stage): boolean {
  // Validate input
  if (!command || command.trim() === '') {
    return false;
  }

  // Check if command starts with "comment-"
  if (!command.startsWith('comment-')) {
    return false;
  }

  // Extract stage suffix from command (everything after "comment-")
  const stageSuffix = command.substring('comment-'.length);

  // Case-insensitive comparison
  return stageSuffix.toUpperCase() === currentStage.toUpperCase();
}
