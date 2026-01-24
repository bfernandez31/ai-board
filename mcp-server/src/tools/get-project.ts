import type { Config } from "../config.js";
import { apiRequest } from "../api-client.js";
import type { ProjectDetails } from "../types.js";

/**
 * Get detailed information about a specific project by ID.
 * Returns full project details including clarification policy and GitHub configuration.
 *
 * @param config - The MCP server configuration
 * @param projectId - The project ID to retrieve
 * @returns Project details
 */
export async function getProject(
  config: Config,
  projectId: number
): Promise<ProjectDetails> {
  return apiRequest<ProjectDetails>(config, `/api/projects/${projectId}`);
}
