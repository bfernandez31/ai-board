/**
 * AI-BOARD Commands Static Data
 *
 * Static command definitions for / autocomplete after @ai-board mention.
 * Commands are added by modifying this file. Each command must:
 * 1. Start with /
 * 2. Have a concise description (max 60 chars)
 * 3. Be user-invocable (not internal AI commands)
 *
 * Not exposed in autocomplete:
 * - Internal commands from .claude/commands/ (e.g., /speckit.plan)
 * - System commands (e.g., /cleanup)
 */

/**
 * Represents an AI-BOARD command available in comment autocomplete
 */
export interface AIBoardCommand {
  /** Command name with leading slash (e.g., "/compare") */
  name: string;

  /** Short description for autocomplete dropdown (max 60 chars) */
  description: string;
}

/**
 * List of AI-BOARD commands available for user invocation in comments
 */
export const AI_BOARD_COMMANDS: AIBoardCommand[] = [
  {
    name: '/compare',
    description: 'Compare ticket implementations for best code quality',
  },
];

/**
 * Filter commands by query (case-insensitive)
 * Matches against command name and description
 *
 * @param query - Search query string
 * @returns Filtered commands matching the query
 */
export function filterCommands(query: string): AIBoardCommand[] {
  if (!query) return AI_BOARD_COMMANDS;

  const q = query.toLowerCase();
  return AI_BOARD_COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q)
  );
}
