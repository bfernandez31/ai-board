/**
 * API Contracts: Ticket Types with WorkflowType
 * Feature: 032-add-workflow-type
 *
 * This file documents the TypeScript type extensions needed
 * to support the workflowType field in the Ticket model.
 */

import { WorkflowType } from '@prisma/client';
import { Stage, ClarificationPolicy } from '@/lib/types';

/**
 * Extended TicketWithVersion interface including workflowType
 *
 * Used by board components to display workflow type badge
 */
export interface TicketWithVersion {
  id: number;
  title: string;
  description: string | null;
  stage: Stage;
  version: number;
  projectId: number;
  branch: string | null;
  autoMode: boolean;
  clarificationPolicy: ClarificationPolicy | null;
  workflowType: WorkflowType;  // ← NEW FIELD
  createdAt: string;
  updatedAt: string;
  project?: {
    clarificationPolicy: ClarificationPolicy;
  };
}

/**
 * Board query response type
 *
 * Tickets grouped by stage, each including workflowType
 */
export interface TicketsByStage {
  INBOX: TicketWithVersion[];
  SPECIFY: TicketWithVersion[];
  PLAN: TicketWithVersion[];
  BUILD: TicketWithVersion[];
  VERIFY: TicketWithVersion[];
  SHIP: TicketWithVersion[];
}

/**
 * Ticket card props
 *
 * Props passed to TicketCard component, including workflowType for badge rendering
 */
export interface TicketCardProps {
  ticket: TicketWithVersion;  // Includes workflowType
  isDraggable: boolean;
  onTicketClick: (ticket: TicketWithVersion) => void;
  projectId: number;
}

/**
 * No REST API contract changes required
 *
 * The workflowType field flows through existing endpoints:
 * - GET /api/projects/:projectId/tickets → Returns tickets with workflowType
 * - PATCH /api/projects/:projectId/tickets/:id → Accepts workflowType (read-only in API)
 * - POST /api/projects/:projectId/tickets/:id/transition → Sets workflowType internally
 *
 * workflowType is NOT exposed in request bodies (set programmatically during transitions)
 */

/**
 * Example Board Query
 *
 * ```typescript
 * const tickets = await prisma.ticket.findMany({
 *   where: { projectId },
 *   select: {
 *     id: true,
 *     title: true,
 *     description: true,
 *     stage: true,
 *     version: true,
 *     projectId: true,
 *     branch: true,
 *     autoMode: true,
 *     clarificationPolicy: true,
 *     workflowType: true,  // ← Include in select
 *     createdAt: true,
 *     updatedAt: true,
 *   }
 * });
 * ```
 */

/**
 * Example Badge Rendering Logic
 *
 * ```tsx
 * // In TicketCard component
 * function TicketCard({ ticket }: TicketCardProps) {
 *   return (
 *     <div className="ticket-card">
 *       <div className="header">
 *         <h3>{ticket.title}</h3>
 *         {ticket.workflowType === 'QUICK' && (
 *           <Badge variant="outline" className="bg-amber-100 text-amber-800">
 *             ⚡ Quick
 *           </Badge>
 *         )}
 *       </div>
 *       {/* ... rest of card ... */}
 *     </div>
 *   );
 * }
 * ```
 */

/**
 * Type Guard for Quick-Impl Tickets
 *
 * Utility function to check if ticket was created via quick-impl
 */
export function isQuickImplTicket(ticket: TicketWithVersion): boolean {
  return ticket.workflowType === 'QUICK';
}

/**
 * Type Guard for Full Workflow Tickets
 *
 * Utility function to check if ticket followed full workflow
 */
export function isFullWorkflowTicket(ticket: TicketWithVersion): boolean {
  return ticket.workflowType === 'FULL';
}
