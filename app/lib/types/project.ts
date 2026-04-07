/**
 * Project with computed ticket count
 * Matches GET /api/projects response schema
 */
export type ProjectHealthLabel =
  | 'Excellent'
  | 'Good'
  | 'Fair'
  | 'Poor'
  | 'No data yet';

export interface ProjectHealthSubScores {
  security: number | null;
  compliance: number | null;
  tests: number | null;
  specSync: number | null;
  qualityGate: number | null;
  reviewQuality: number | null;
}

export interface ProjectHealthSummary {
  globalScore: number | null;
  label: ProjectHealthLabel;
  color: {
    text: string;
    bg: string;
    fill: string;
  };
  subScores: ProjectHealthSubScores;
}

export interface ProjectWithCount {
  id: number;
  key: string;
  name: string;
  description: string;
  githubOwner: string;
  githubRepo: string;
  deploymentUrl: string | null;
  updatedAt: string; // ISO 8601 timestamp
  ticketCount: number;
  lastShippedTicket: {
    id: number;
    ticketKey: string;
    title: string;
    updatedAt: string; // ISO 8601 timestamp
  } | null;
  healthSummary: ProjectHealthSummary;
}

/**
 * Shipped ticket display data for project cards
 */
export interface ShippedTicketDisplay {
  title: string;
  timestamp: string; // Formatted relative time
  hasShipped: boolean;
}

/**
 * API response for GET /api/projects
 */
export type ProjectsListResponse = ProjectWithCount[];
