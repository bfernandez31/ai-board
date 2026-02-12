import { ParsedMention } from '@/app/lib/types/mention';

/**
 * Regex pattern for parsing mention markup: @[userId:displayName]
 * Global flag for multiple matches.
 */
export const MENTION_REGEX = /@\[([^:]+):([^\]]+)\]/g;

export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  MENTION_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
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

export function formatMention(userId: string, displayName: string): string {
  return `@[${userId}:${displayName}]`;
}

export function extractMentionUserIds(content: string): string[] {
  const mentions = parseMentions(content);
  return Array.from(new Set(mentions.map(m => m.userId)));
}

export function validateMentionFormat(content: string): boolean {
  if (!content.includes('@[')) return true;

  MENTION_REGEX.lastIndex = 0;
  const mentions = Array.from(content.matchAll(MENTION_REGEX));
  const atBracketCount = content.split('@[').length - 1;
  return atBracketCount === mentions.length;
}
