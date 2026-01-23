import type { Config } from "../config.js";
import { apiRequest } from "../api-client.js";
import type { TicketDetails } from "../types.js";

/**
 * Get detailed information about a specific ticket by its key.
 * Returns full ticket details including stage, branch, workflow type,
 * and associated project information.
 *
 * @param config - The MCP server configuration
 * @param projectId - The project ID the ticket belongs to
 * @param ticketKey - The ticket key (e.g., "AIB-123")
 * @returns Ticket details
 */
export async function getTicket(
  config: Config,
  projectId: number,
  ticketKey: string
): Promise<TicketDetails> {
  return apiRequest<TicketDetails>(
    config,
    `/api/projects/${projectId}/tickets/${ticketKey}`
  );
}
