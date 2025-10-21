import { Stage } from '@prisma/client';

/**
 * Document type that can be edited
 */
export type DocType = 'spec' | 'plan' | 'tasks' | 'images';

/**
 * Stage-based permission rules for documentation editing
 *
 * - SPECIFY stage: Only spec.md can be edited
 * - PLAN stage: Only plan.md and tasks.md can be edited
 * - Other stages: No editing allowed
 */
interface EditPermission {
  stage: Stage;
  allowedDocTypes: DocType[];
}

const EDIT_PERMISSIONS: EditPermission[] = [
  { stage: 'SPECIFY', allowedDocTypes: ['spec', 'images'] },
  { stage: 'PLAN', allowedDocTypes: ['plan', 'tasks', 'images'] },
];

/**
 * Checks if a document can be edited based on the current ticket stage
 *
 * @param ticketStage - Current stage of the ticket
 * @param docType - Type of document to check (spec, plan, or tasks)
 * @returns True if editing is allowed, false otherwise
 *
 * @example
 * // User wants to edit spec.md
 * const canEditSpec = canEdit('SPECIFY', 'spec'); // true
 * const canEditPlan = canEdit('SPECIFY', 'plan'); // false
 *
 * // User wants to edit plan.md
 * const canEditPlan = canEdit('PLAN', 'plan'); // true
 * const canEditSpec = canEdit('PLAN', 'spec'); // false
 */
export function canEdit(ticketStage: Stage, docType: DocType): boolean {
  const permission = EDIT_PERMISSIONS.find((p) => p.stage === ticketStage);
  return permission?.allowedDocTypes.includes(docType) ?? false;
}

/**
 * Gets all allowed document types for a given stage
 *
 * @param ticketStage - Current stage of the ticket
 * @returns Array of allowed document types
 */
export function getAllowedDocTypes(ticketStage: Stage): DocType[] {
  const permission = EDIT_PERMISSIONS.find((p) => p.stage === ticketStage);
  return permission?.allowedDocTypes ?? [];
}

/**
 * Gets a human-readable error message when editing is not allowed
 *
 * @param ticketStage - Current stage of the ticket
 * @param docType - Type of document that was attempted to edit
 * @returns Error message explaining why editing is not allowed
 */
export function getPermissionErrorMessage(ticketStage: Stage, docType: DocType): string {
  const allowedTypes = getAllowedDocTypes(ticketStage);

  if (allowedTypes.length === 0) {
    return `Documents cannot be edited in ${ticketStage} stage`;
  }

  return `Cannot edit ${docType}.md in ${ticketStage} stage. Only ${allowedTypes.map((t) => `${t}.md`).join(' and ')} can be edited in this stage.`;
}
