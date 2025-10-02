/**
 * Stage Validation Utilities
 *
 * Provides stage enum and validation functions for sequential workflow transitions.
 * Tickets can only move to the immediately next stage (no skipping, no backwards).
 */

export enum Stage {
  INBOX = 'INBOX',
  SPECIFY = 'SPECIFY',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  SHIP = 'SHIP',
}

/**
 * Ordered array of stages representing the sequential workflow.
 * INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP
 */
const STAGE_ORDER: Stage[] = [
  Stage.INBOX,
  Stage.SPECIFY,
  Stage.PLAN,
  Stage.BUILD,
  Stage.VERIFY,
  Stage.SHIP,
];

/**
 * Get the next valid stage in the workflow sequence.
 *
 * @param currentStage - The current stage
 * @returns The next stage in sequence, or null if already at final stage or invalid stage
 *
 * @example
 * getNextStage(Stage.INBOX) // Returns Stage.SPECIFY
 * getNextStage(Stage.SPECIFY) // Returns Stage.PLAN
 * getNextStage(Stage.SHIP)  // Returns null (terminal stage)
 */
export function getNextStage(currentStage: Stage): Stage | null {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);

  // Invalid stage or already at final stage
  if (currentIndex === -1 || currentIndex === STAGE_ORDER.length - 1) {
    return null;
  }

  const nextStage = STAGE_ORDER[currentIndex + 1];
  return nextStage ?? null;
}

/**
 * Validate if a stage transition is allowed.
 * Only sequential transitions to the immediately next stage are valid.
 *
 * @param fromStage - The current stage
 * @param toStage - The target stage
 * @returns true if transition is valid (sequential), false otherwise
 *
 * @example
 * isValidTransition(Stage.INBOX, Stage.SPECIFY)  // true (valid: next stage)
 * isValidTransition(Stage.INBOX, Stage.PLAN)    // false (invalid: skipping SPECIFY)
 * isValidTransition(Stage.SPECIFY, Stage.PLAN)  // true (valid: next stage)
 * isValidTransition(Stage.BUILD, Stage.PLAN)    // false (invalid: backwards)
 * isValidTransition(Stage.SHIP, Stage.INBOX)    // false (invalid: backwards from terminal)
 */
export function isValidTransition(fromStage: Stage, toStage: Stage): boolean {
  const nextStage = getNextStage(fromStage);
  return nextStage === toStage;
}

/**
 * Get all valid stage values as an array.
 * Useful for validation and dropdown generation.
 *
 * @returns Array of all stage values in order
 */
export function getAllStages(): Stage[] {
  return [...STAGE_ORDER];
}

/**
 * Check if a stage is the terminal stage (no further transitions possible).
 *
 * @param stage - The stage to check
 * @returns true if stage is SHIP (terminal), false otherwise
 */
export function isTerminalStage(stage: Stage): boolean {
  return stage === Stage.SHIP;
}
