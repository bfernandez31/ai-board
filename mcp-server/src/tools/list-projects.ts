import type { Config } from "../config.js";
import { apiRequest } from "../api-client.js";
import type { ProjectSummary } from "../types.js";

/**
 * List all projects the authenticated user has access to.
 * Returns projects where the user is either the owner or a member.
 *
 * @param config - The MCP server configuration
 * @returns Array of project summaries
 */
export async function listProjects(config: Config): Promise<ProjectSummary[]> {
  return apiRequest<ProjectSummary[]>(config, "/api/projects");
}
