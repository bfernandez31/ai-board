import type { Config } from "../config.js";
import { apiRequest } from "../api-client.js";
import type { CreateTicketRequest, CreateTicketResponse } from "../types.js";

/**
 * Input for creating a ticket
 */
export interface CreateTicketInput {
  projectId: number;
  title: string;
  description: string;
}

/**
 * Create a new ticket in a project's INBOX stage.
 * The ticket will be created with FULL workflow type.
 *
 * @param config - The MCP server configuration
 * @param input - The ticket creation parameters
 * @returns Created ticket details
 */
export async function createTicket(
  config: Config,
  input: CreateTicketInput
): Promise<CreateTicketResponse> {
  const body: CreateTicketRequest = {
    title: input.title,
    description: input.description,
  };

  return apiRequest<CreateTicketResponse>(
    config,
    `/api/projects/${input.projectId}/tickets`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}
