// Mention parsing and formatting utilities

import { ParsedMention } from '@/app/lib/types/mention';

/**
 * Regex pattern for parsing mention markup: @[userId:displayName]
 * - Group 1: userId (alphanumeric + hyphens)
 * - Group 2: displayName (any characters except ])
 * - Global flag for multiple matches
 */
export const MENTION_REGEX = /@\[([^:]+):([^\]]+)\]/g;

/**
 * Parse mention markup from comment content
 *
 * @param content - Comment content potentially containing mentions
 * @returns Array of parsed mention objects with position information
 *
 * @example
 * parseMentions("Hey @[user-123:John], check @[user-456:Jane]")
 * // Returns:
 * // [
 * //   { userId: 'user-123', displayName: 'John', startIndex: 4, endIndex: 22 },
 * //   { userId: 'user-456', displayName: 'Jane', startIndex: 30, endIndex: 48 }
 * // ]
 */
export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];

  // Reset regex lastIndex to ensure consistent parsing
  MENTION_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = MENTION_REGEX.exec(content)) !== null) {
    // TypeScript strict mode: ensure capture groups exist
    const userId = match[1];
    const displayName = match[2];

    if (!userId || !displayName) continue;

    mentions.push({
      userId,
      displayName,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return mentions;
}

/**
 * Format a mention into markup syntax
 *
 * @param userId - User ID to mention
 * @param displayName - Display name for the mention
 * @returns Formatted mention markup string
 *
 * @example
 * formatMention('user-123', 'John Doe')
 * // Returns: '@[user-123:John Doe]'
 */
export function formatMention(userId: string, displayName: string): string {
  return `@[${userId}:${displayName}]`;
}

/**
 * Extract all unique user IDs from comment content
 *
 * @param content - Comment content potentially containing mentions
 * @returns Array of unique user IDs
 *
 * @example
 * extractMentionUserIds("Hey @[user-123:John], check @[user-123:John] and @[user-456:Jane]")
 * // Returns: ['user-123', 'user-456']
 */
export function extractMentionUserIds(content: string): string[] {
  const mentions = parseMentions(content);
  const uniqueUserIds = Array.from(new Set(mentions.map(m => m.userId)));
  return uniqueUserIds;
}

/**
 * Validate mention markup format
 *
 * @param content - Comment content to validate
 * @returns true if all @[ sequences are valid mentions, false otherwise
 *
 * @example
 * validateMentionFormat("Hey @[user-123:John]") // true
 * validateMentionFormat("Hey @[invalid") // false
 */
export function validateMentionFormat(content: string): boolean {
  if (!content.includes('@[')) return true;

  MENTION_REGEX.lastIndex = 0;
  const mentions = Array.from(content.matchAll(MENTION_REGEX));

  // All @[ sequences must be valid mentions
  const atBracketCount = content.split('@[').length - 1;
  return atBracketCount === mentions.length;
}
