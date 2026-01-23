import type { Config } from "../config.js";
import { apiRequest } from "../api-client.js";
import type { Stage, TransitionRequest, TransitionResponse } from "../types.js";

/**
 * Input for moving a ticket to a new stage
 */
export interface MoveTicketInput {
  projectId: number;
  ticketKey: string;
  targetStage: Stage;
}

/**
 * Move a ticket to a different workflow stage.
 * Valid transitions depend on current stage and workflow type.
 *
 * @param config - The MCP server configuration
 * @param input - The move parameters
 * @returns Transition response with updated ticket info
 */
export async function moveTicket(
  config: Config,
  input: MoveTicketInput
): Promise<TransitionResponse> {
  const body: TransitionRequest = {
    targetStage: input.targetStage,
  };

  return apiRequest<TransitionResponse>(
    config,
    `/api/projects/${input.projectId}/tickets/${input.ticketKey}/transition`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}
