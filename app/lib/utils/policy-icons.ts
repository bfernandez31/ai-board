import { ClarificationPolicy } from '@prisma/client';

/**
 * Get the icon/emoji for a clarification policy
 * Used for consistent visual representation across UI
 *
 * @param policy - Clarification policy
 * @returns Icon emoji string
 */
export function getPolicyIcon(policy: ClarificationPolicy): string {
  const icons: Record<ClarificationPolicy, string> = {
    [ClarificationPolicy.AUTO]: '🤖',
    [ClarificationPolicy.CONSERVATIVE]: '🛡️',
    [ClarificationPolicy.PRAGMATIC]: '⚡',
    [ClarificationPolicy.INTERACTIVE]: '💬',
  };
  return icons[policy];
}

/**
 * Get the human-readable label for a clarification policy
 *
 * @param policy - Clarification policy
 * @returns Label string
 */
export function getPolicyLabel(policy: ClarificationPolicy): string {
  const labels: Record<ClarificationPolicy, string> = {
    [ClarificationPolicy.AUTO]: 'AUTO',
    [ClarificationPolicy.CONSERVATIVE]: 'CONSERVATIVE',
    [ClarificationPolicy.PRAGMATIC]: 'PRAGMATIC',
    [ClarificationPolicy.INTERACTIVE]: 'INTERACTIVE',
  };
  return labels[policy];
}

/**
 * Get a short description for a clarification policy
 * Used in tooltips and help text
 *
 * @param policy - Clarification policy
 * @returns Description string
 */
export function getPolicyDescription(policy: ClarificationPolicy): string {
  const descriptions: Record<ClarificationPolicy, string> = {
    [ClarificationPolicy.AUTO]: 'Context-aware decisions (system default)',
    [ClarificationPolicy.CONSERVATIVE]: 'Security & quality first',
    [ClarificationPolicy.PRAGMATIC]: 'Speed & simplicity first',
    [ClarificationPolicy.INTERACTIVE]: 'Manual clarification (future)',
  };
  return descriptions[policy];
}
