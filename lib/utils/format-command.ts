/**
 * Format a kebab-case command name for display.
 * e.g., "comment-specify" → "Comment Specify", "quick-impl" → "Quick Impl"
 */
export function formatCommandName(command: string): string {
  return command
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
