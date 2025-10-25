import { Stage } from '@prisma/client';

/**
 * Stage-Based Editing Restrictions Utility
 * Feature: 051-895-restricted-description
 *
 * Determines if ticket description and clarificationPolicy can be edited
 * based on the current workflow stage.
 *
 * Business Rule: Description and policy editing is only allowed in INBOX stage.
 * Once tickets move to SPECIFY, PLAN, BUILD, VERIFY, or SHIP stages, these fields
 * become read-only to ensure specification stability during active development.
 */

/**
 * Determines if description and clarification policy can be edited based on ticket stage
 *
 * @param stage - Current ticket stage
 * @returns true if stage is INBOX, false otherwise
 *
 * @example
 * ```ts
 * // INBOX stage - editing allowed
 * canEditDescriptionAndPolicy(Stage.INBOX); // → true
 *
 * // Non-INBOX stages - editing NOT allowed
 * canEditDescriptionAndPolicy(Stage.SPECIFY); // → false
 * canEditDescriptionAndPolicy(Stage.PLAN);    // → false
 * canEditDescriptionAndPolicy(Stage.BUILD);   // → false
 * canEditDescriptionAndPolicy(Stage.VERIFY);  // → false
 * canEditDescriptionAndPolicy(Stage.SHIP);    // → false
 * ```
 */
export function canEditDescriptionAndPolicy(stage: Stage): boolean {
  return stage === Stage.INBOX;
}
