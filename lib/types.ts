import {
  Ticket as PrismaTicket,
  ClarificationPolicy,
  Agent,
  WorkflowType,
  Prisma,
  JobStatus,
  Stage as PrismaStage,
} from '@prisma/client';
import { Stage } from './stage-transitions';

/**
 * Re-export types
 */
export type { Stage, WorkflowType };
export type Ticket = PrismaTicket;

/**
 * Drag-and-Drop Types
 */

/**
 * Ticket with version field for optimistic concurrency control
 */
export interface TicketWithVersion {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string | null;
  stage: Stage;
  version: number;
  projectId: number;
  branch: string | null;
  previewUrl?: string | null;
  autoMode: boolean;
  clarificationPolicy: ClarificationPolicy | null;
  agent: Agent | null;
  workflowType: WorkflowType;
  attachments: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
  project?: {
    clarificationPolicy: ClarificationPolicy;
    defaultAgent?: Agent;
    githubOwner?: string;
    githubRepo?: string;
  };
  jobs?: Array<{
    status: JobStatus;
    command: string;
    createdAt: Date;
  }>;
}

export type ProjectNavigationDestinationId =
  | 'board'
  | 'activity'
  | 'analytics'
  | 'settings';

export type ProjectNavigationGroup = 'primary' | 'footer';

export type ProjectDestinationIconKey =
  | 'activity'
  | 'bar-chart-3'
  | 'kanban-square'
  | 'settings';

export interface ProjectNavigationDestination {
  id: ProjectNavigationDestinationId;
  label: string;
  description: string;
  href: string;
  iconKey: ProjectDestinationIconKey;
  group: ProjectNavigationGroup;
  keywords: string[];
  isActive: boolean;
}

export type CommandPaletteTicketMatchType =
  | 'exact-key'
  | 'prefix'
  | 'substring'
  | 'subsequence';

interface CommandPaletteResultBase {
  id: string;
  label: string;
  description?: string;
  href: string;
  matchScore: number;
}

export interface CommandPaletteDestinationResult extends CommandPaletteResultBase {
  type: 'destination';
}

export interface CommandPaletteTicketResult extends CommandPaletteResultBase {
  type: 'ticket';
  ticketKey: string;
  stage: PrismaStage;
  matchType: CommandPaletteTicketMatchType;
}

export type CommandPaletteResult =
  | CommandPaletteDestinationResult
  | CommandPaletteTicketResult;

export interface CommandPaletteResponse {
  query: string;
  groups: {
    destinations: CommandPaletteDestinationResult[];
    tickets: CommandPaletteTicketResult[];
  };
  totalCount: {
    destinations: number;
    tickets: number;
  };
}
