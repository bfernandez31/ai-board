import type { Config } from "../config.js";
import { apiRequest } from "../api-client.js";
import { ApiError, ErrorCode } from "../errors.js";
import type { TicketDetails, UpdateTicketRequest, UpdateTicketResponse } from "../types.js";

/**
 * Input for updating a ticket's title and/or description.
 * Only allowed when the ticket is in INBOX stage.
 */
export interface UpdateTicketInput {
  projectId: number;
  ticketKey: string;
  title?: string;
  description?: string;
}

/**
 * Update an INBOX ticket's title and/or description.
 *
 * Fetches the ticket first to validate the INBOX stage and obtain the
 * current `version` for optimistic concurrency, then issues a PATCH.
 *
 * @param config - The MCP server configuration
 * @param input - The update parameters
 * @returns Updated ticket details
 */
export async function updateTicket(
  config: Config,
  input: UpdateTicketInput
): Promise<UpdateTicketResponse> {
  if (input.title === undefined && input.description === undefined) {
    throw new ApiError(
      400,
      "At least one of title or description must be provided.",
      ErrorCode.VALIDATION_ERROR
    );
  }

  const current = await apiRequest<TicketDetails>(
    config,
    `/api/projects/${input.projectId}/tickets/${input.ticketKey}`
  );

  if (current.stage !== "INBOX") {
    throw new ApiError(
      400,
      `Ticket ${input.ticketKey} is in ${current.stage} stage. Only tickets in INBOX can be edited.`,
      ErrorCode.VALIDATION_ERROR
    );
  }

  const body: UpdateTicketRequest = {
    version: current.version,
    ...(input.title !== undefined && { title: input.title }),
    ...(input.description !== undefined && { description: input.description }),
  };

  return apiRequest<UpdateTicketResponse>(
    config,
    `/api/projects/${input.projectId}/tickets/${current.id}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
}
