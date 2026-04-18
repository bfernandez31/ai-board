import type { Stage } from '@prisma/client';

/**
 * Compute the list of stages that will run automatically once auto-mode is enabled
 * on a ticket currently in the given stage.
 *
 * - INBOX → ['SPECIFY','PLAN','BUILD']
 * - SPECIFY → ['PLAN','BUILD']
 * - PLAN → ['BUILD']
 * - any other stage → []
 */
export function computeChainedStages(stage: Stage): Stage[] {
  switch (stage) {
    case 'INBOX':
      return ['SPECIFY', 'PLAN', 'BUILD'];
    case 'SPECIFY':
      return ['PLAN', 'BUILD'];
    case 'PLAN':
      return ['BUILD'];
    default:
      return [];
  }
}
