/**
 * Project with computed ticket count
 * Matches GET /api/projects response schema
 */
export interface ProjectHealthScore {
  globalScore: number | null;
  securityScore: number | null;
  complianceScore: number | null;
  testsScore: number | null;
  specSyncScore: number | null;
  qualityGate: number | null;
  reviewQualityScore: number | null;
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
  healthScore: ProjectHealthScore | null;
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
