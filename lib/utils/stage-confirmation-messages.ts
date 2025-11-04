import { Ticket, Stage } from '@prisma/client';

/**
 * Generates stage-specific confirmation message for ticket deletion
 *
 * Messages explain what will be deleted based on the ticket's current stage:
 * - INBOX: No workflow artifacts (just the ticket record)
 * - SPECIFY: Branch + spec.md
 * - PLAN: Branch + spec.md + plan.md + tasks.md
 * - BUILD: Branch + implementation artifacts + PR
 * - VERIFY: Branch + preview deployment + PR + all workflow artifacts
 * - SHIP: Not deletable (excluded by business rule)
 *
 * @param ticket - Ticket object with stage property
 * @returns Confirmation message describing what will be deleted
 *
 * @example
 * ```typescript
 * const inboxTicket = { id: 1, stage: 'INBOX', branch: null };
 * getConfirmationMessage(inboxTicket);
 * // "This ticket has no workflow artifacts. Only the ticket record will be deleted."
 *
 * const buildTicket = { id: 2, stage: 'BUILD', branch: '084-feature' };
 * getConfirmationMessage(buildTicket);
 * // "This will permanently delete:\n- Git branch: 084-feature\n- ..."
 * ```
 */
export function getConfirmationMessage(ticket: Ticket): string {
  switch (ticket.stage) {
    case Stage.INBOX:
      return 'This ticket has no workflow artifacts. Only the ticket record will be deleted.';

    case Stage.SPECIFY:
      if (ticket.branch) {
        return `This will permanently delete:
- Git branch: ${ticket.branch}
- Specification document (spec.md)

This action cannot be undone.`;
      }
      return 'This will permanently delete the ticket and specification document. This action cannot be undone.';

    case Stage.PLAN:
      if (ticket.branch) {
        return `This will permanently delete:
- Git branch: ${ticket.branch}
- Specification document (spec.md)
- Implementation plan (plan.md)
- Task breakdown (tasks.md)

This action cannot be undone.`;
      }
      return 'This will permanently delete the ticket and all planning documents. This action cannot be undone.';

    case Stage.BUILD:
      if (ticket.branch) {
        return `This will permanently delete:
- Git branch: ${ticket.branch}
- All pull requests associated with this branch
- Specification and planning documents
- Implementation artifacts

This action cannot be undone.`;
      }
      return 'This will permanently delete the ticket and all workflow artifacts. This action cannot be undone.';

    case Stage.VERIFY:
      const artifacts = ['Git branch: ' + (ticket.branch || '(none)')];

      if (ticket.previewUrl) {
        artifacts.push('Preview deployment');
      }

      artifacts.push(
        'All pull requests',
        'Specification and planning documents',
        'Implementation artifacts'
      );

      return `This will permanently delete:
${artifacts.map((a) => `- ${a}`).join('\n')}

This action cannot be undone.`;

    case Stage.SHIP:
      // Should never reach here (SHIP tickets are not deletable per business rules)
      return 'SHIP stage tickets cannot be deleted.';

    default:
      return 'This will permanently delete the ticket. This action cannot be undone.';
  }
}

/**
 * Gets a short summary of what will be deleted (for UI badges/tooltips)
 *
 * @param ticket - Ticket object with stage property
 * @returns Short summary string
 *
 * @example
 * ```typescript
 * const buildTicket = { id: 1, stage: 'BUILD', branch: '084-feature' };
 * getDeletionSummary(buildTicket);
 * // "Branch + PR + artifacts"
 * ```
 */
export function getDeletionSummary(ticket: Ticket): string {
  switch (ticket.stage) {
    case Stage.INBOX:
      return 'Ticket record only';

    case Stage.SPECIFY:
      return ticket.branch ? 'Branch + spec.md' : 'Spec.md only';

    case Stage.PLAN:
      return ticket.branch ? 'Branch + planning docs' : 'Planning docs only';

    case Stage.BUILD:
      return ticket.branch ? 'Branch + PR + artifacts' : 'Workflow artifacts';

    case Stage.VERIFY:
      return ticket.previewUrl
        ? 'Branch + PR + preview + artifacts'
        : 'Branch + PR + artifacts';

    case Stage.SHIP:
      return 'Cannot delete SHIP tickets';

    default:
      return 'Ticket';
  }
}
