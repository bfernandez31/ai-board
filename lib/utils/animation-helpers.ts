/**
 * Animation Helpers for Mini-Kanban Demo
 * Pure utility functions for ticket progression and animation logic
 */

/**
 * Type-safe column index (0-5 representing INBOX through SHIP)
 */
export type ColumnIndex = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Workflow stage names enum
 */
export enum WorkflowStageName {
  INBOX = 'INBOX',
  SPECIFY = 'SPECIFY',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  SHIP = 'SHIP',
}

/**
 * Demo ticket interface
 */
export interface DemoTicket {
  id: number;
  title: string;
  column: number; // 0-5 (INBOX to SHIP)
}

/**
 * Workflow stage configuration
 */
export interface WorkflowStage {
  index: number;
  name: string;
  label: string;
  color: string; // Tailwind CSS color class
}

/**
 * Animation state interface
 */
export interface AnimationState {
  tickets: DemoTicket[];
  isPaused: boolean;
  isVisible: boolean;
  prefersReducedMotion: boolean;
}

/**
 * Hardcoded demo tickets for landing page
 */
export const DEMO_TICKETS: readonly DemoTicket[] = [
  { id: 1, title: 'Add user authentication', column: 1 }, // SPECIFY
  { id: 2, title: 'Fix mobile layout bug', column: 3 },   // BUILD
  { id: 3, title: 'Implement dark mode', column: 0 },     // INBOX
] as const;

/**
 * Hardcoded workflow stages configuration
 */
export const WORKFLOW_STAGES: readonly WorkflowStage[] = [
  { index: 0, name: 'INBOX', label: 'Inbox', color: 'bg-gray-50' },
  { index: 1, name: 'SPECIFY', label: 'Specify', color: 'bg-blue-50' },
  { index: 2, name: 'PLAN', label: 'Plan', color: 'bg-purple-50' },
  { index: 3, name: 'BUILD', label: 'Build', color: 'bg-green-50' },
  { index: 4, name: 'VERIFY', label: 'Verify', color: 'bg-yellow-50' },
  { index: 5, name: 'SHIP', label: 'Ship', color: 'bg-pink-50' },
] as const;

/**
 * Calculates the next column index for a ticket.
 * Wraps around to INBOX (0) after SHIP (5).
 *
 * @param currentColumn - Current column index (0-5)
 * @returns Next column index, wrapping to 0 after 5
 *
 * @example
 * calculateNextColumn(0) // returns 1 (INBOX → SPECIFY)
 * calculateNextColumn(5) // returns 0 (SHIP → INBOX)
 */
export function calculateNextColumn(currentColumn: number): number {
  return currentColumn < 5 ? currentColumn + 1 : 0;
}

/**
 * Checks if animations should run based on pause state,
 * visibility, and user accessibility preferences.
 *
 * @param isPaused - True if user has hovered over the board
 * @param isVisible - True if section is in viewport
 * @param prefersReducedMotion - True if user has prefers-reduced-motion: reduce
 * @returns True if animations should run
 *
 * @example
 * shouldAnimate(false, true, false) // returns true (normal animation)
 * shouldAnimate(true, true, false)  // returns false (paused on hover)
 * shouldAnimate(false, true, true)  // returns false (reduced motion)
 */
export function shouldAnimate(
  isPaused: boolean,
  isVisible: boolean,
  prefersReducedMotion: boolean
): boolean {
  return !isPaused && isVisible && !prefersReducedMotion;
}

/**
 * Maps column index (0-5) to workflow stage name.
 *
 * @param index - Column index (0-5)
 * @returns Workflow stage name (INBOX, SPECIFY, etc.)
 *
 * @example
 * getColumnName(0) // returns 'INBOX'
 * getColumnName(5) // returns 'SHIP'
 */
export function getColumnName(index: number): string {
  const stages: string[] = [
    WorkflowStageName.INBOX,
    WorkflowStageName.SPECIFY,
    WorkflowStageName.PLAN,
    WorkflowStageName.BUILD,
    WorkflowStageName.VERIFY,
    WorkflowStageName.SHIP,
  ];
  return stages[index] || 'UNKNOWN';
}
