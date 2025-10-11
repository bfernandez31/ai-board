/**
 * Project with computed ticket count
 * Matches GET /api/projects response schema
 */
export interface ProjectWithCount {
  id: number;
  name: string;
  description: string;
  updatedAt: string; // ISO 8601 timestamp
  ticketCount: number;
}

/**
 * API response for GET /api/projects
 */
export type ProjectsListResponse = ProjectWithCount[];
