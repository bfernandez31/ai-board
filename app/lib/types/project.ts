/**
 * Project with computed ticket count
 * Matches GET /api/projects response schema
 */
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
  healthScore: {
    globalScore: number | null;
    securityScore: number | null;
    complianceScore: number | null;
    testsScore: number | null;
    specSyncScore: number | null;
    qualityGate: number | null;
    reviewQualityScore: number | null;
  } | null;
}

/**
 * Shipped ticket display data for project cards
 */
export interface ShippedTicketDisplay {
  title: string;
  timestamp: string; // Formatted relative time
  hasShipped: boolean;
}

export type ProjectsActivityPeriod = 'last-12-months' | 'year';
export type ProjectsActivityAgentFilter = 'all' | 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI';

export interface ProjectsActivityFilters {
  period: ProjectsActivityPeriod;
  year: number | null;
  agent: ProjectsActivityAgentFilter;
}

export interface ProjectsActivityPeriodOption {
  value: string;
  label: string;
  rangeStart: string;
  rangeEnd: string;
  kind: 'rolling' | 'calendar-year';
}

export interface ProjectsActivityAgentOption {
  value: ProjectsActivityAgentFilter;
  label: string;
}

export interface ProjectsActivityShippedTicket {
  ticketId: number;
  ticketKey: string;
  title: string;
}

export interface ProjectsActivityDayCell {
  date: string;
  weekIndex: number;
  weekdayIndex: number;
  monthLabel: string | null;
  jobCount: number;
  shippedTicketCount: number;
  costUsd: number | null;
  intensityLevel: 0 | 1 | 2 | 3 | 4;
  shippedTickets: ProjectsActivityShippedTicket[];
}

export interface ProjectsActivitySummary {
  totalJobs: number;
  totalShippedTickets: number;
  summaryLabel: string;
}

export interface ProjectsActivityHeatmapResponse {
  filters: ProjectsActivityFilters;
  periodOptions: ProjectsActivityPeriodOption[];
  agentOptions: ProjectsActivityAgentOption[];
  summary: ProjectsActivitySummary;
  days: ProjectsActivityDayCell[];
  legendLevels: readonly [0, 1, 2, 3, 4];
  hasActivity: boolean;
  generatedAt: string;
}

/**
 * API response for GET /api/projects
 */
export type ProjectsListResponse = ProjectWithCount[];

/**
 * Maps a Prisma project query result (from getUserProjects) to the API response shape.
 */
export function toProjectWithCount(project: {
  id: number;
  key: string;
  name: string;
  description: string;
  githubOwner: string;
  githubRepo: string;
  deploymentUrl: string | null;
  updatedAt: Date;
  _count: { tickets: number };
  tickets: Array<{ id: number; ticketKey: string; title: string; updatedAt: Date }>;
  healthScore: ProjectWithCount['healthScore'] | null;
}): ProjectWithCount {
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    description: project.description,
    githubOwner: project.githubOwner,
    githubRepo: project.githubRepo,
    deploymentUrl: project.deploymentUrl,
    updatedAt: project.updatedAt.toISOString(),
    ticketCount: project._count.tickets,
    lastShippedTicket: project.tickets[0] ? {
      id: project.tickets[0].id,
      ticketKey: project.tickets[0].ticketKey,
      title: project.tickets[0].title,
      updatedAt: project.tickets[0].updatedAt.toISOString(),
    } : null,
    healthScore: project.healthScore ?? null,
  };
}
