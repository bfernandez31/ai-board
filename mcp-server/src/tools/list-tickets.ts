import type { Config } from "../config.js";
import { apiRequest } from "../api-client.js";
import type { TicketsByStage, TicketSummary, Stage } from "../types.js";

/**
 * List all tickets in a project, optionally filtered by stage.
 * Returns tickets grouped by their current workflow stage.
 *
 * @param config - The MCP server configuration
 * @param projectId - The project ID to list tickets from
 * @param stage - Optional stage filter
 * @returns Tickets grouped by stage, or filtered to specific stage
 */
export async function listTickets(
  config: Config,
  projectId: number,
  stage?: Stage
): Promise<TicketsByStage | TicketSummary[]> {
  const tickets = await apiRequest<TicketsByStage>(
    config,
    `/api/projects/${projectId}/tickets`
  );

  // If stage filter is specified, return only tickets from that stage
  if (stage) {
    return tickets[stage];
  }

  return tickets;
}
