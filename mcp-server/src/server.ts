import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "./config.js";
import { formatError } from "./errors.js";
import { listProjects } from "./tools/list-projects.js";
import { getProject } from "./tools/get-project.js";
import { listTickets } from "./tools/list-tickets.js";
import { getTicket } from "./tools/get-ticket.js";
import { createTicket } from "./tools/create-ticket.js";
import { moveTicket } from "./tools/move-ticket.js";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

/**
 * Wrap a tool handler with standardized error handling and JSON formatting.
 */
async function handleToolCall<T>(
  fn: () => Promise<T>,
  formatResult?: (result: T) => string
): Promise<ToolResult> {
  try {
    const result = await fn();
    const text = formatResult ? formatResult(result) : JSON.stringify(result, null, 2);
    return { content: [{ type: "text", text }] };
  } catch (error) {
    return { content: [{ type: "text", text: formatError(error) }], isError: true };
  }
}

/**
 * Create and configure the MCP server with all tools registered.
 *
 * @param config - The validated configuration
 * @returns Configured MCP server instance
 */
export function createServer(config: Config): McpServer {
  const server = new McpServer({
    name: "ai-board-mcp",
    version: "1.0.0",
  });

  // =====================
  // User Story 1: Projects
  // =====================

  server.tool(
    "list_projects",
    "List all projects the authenticated user has access to. Returns projects where the user is either the owner or a member.",
    {},
    () => handleToolCall(() => listProjects(config))
  );

  server.tool(
    "get_project",
    "Get detailed information about a specific project by ID. Returns full project details including clarification policy and GitHub configuration.",
    {
      projectId: z.number().int().positive().describe("Project ID to retrieve"),
    },
    ({ projectId }) => handleToolCall(() => getProject(config, projectId))
  );

  // =====================
  // User Story 2: Tickets
  // =====================

  server.tool(
    "list_tickets",
    "List all tickets in a project, optionally filtered by stage. Returns tickets grouped by their current workflow stage.",
    {
      projectId: z.number().int().positive().describe("Project ID to list tickets from"),
      stage: z
        .enum(["INBOX", "SPECIFY", "PLAN", "BUILD", "VERIFY", "SHIP"])
        .optional()
        .describe("Optional stage filter"),
    },
    ({ projectId, stage }) => handleToolCall(() => listTickets(config, projectId, stage))
  );

  server.tool(
    "get_ticket",
    "Get detailed information about a specific ticket by its key. Returns full ticket details including stage, branch, workflow type, and project info.",
    {
      projectId: z.number().int().positive().describe("Project ID the ticket belongs to"),
      ticketKey: z
        .string()
        .regex(/^[A-Z]{3,6}-\d+$/)
        .describe("Ticket key (e.g., 'AIB-123')"),
    },
    ({ projectId, ticketKey }) => handleToolCall(() => getTicket(config, projectId, ticketKey))
  );

  // =====================
  // User Story 3: Create Ticket
  // =====================

  server.tool(
    "create_ticket",
    "Create a new ticket in a project's INBOX stage. The ticket will be created with FULL workflow type.",
    {
      projectId: z.number().int().positive().describe("Project ID to create the ticket in"),
      title: z
        .string()
        .min(1, "Title must be at least 1 character")
        .max(100, "Title must be at most 100 characters")
        .describe("Ticket title (1-100 characters)"),
      description: z
        .string()
        .min(1, "Description must be at least 1 character")
        .max(10000, "Description must be at most 10000 characters")
        .describe("Ticket description in Markdown (1-10000 characters)"),
    },
    ({ projectId, title, description }) =>
      handleToolCall(
        () => createTicket(config, { projectId, title, description }),
        (ticket) => `Created ticket ${ticket.ticketKey}\n\n${JSON.stringify(ticket, null, 2)}`
      )
  );

  // =====================
  // User Story 4: Move Ticket
  // =====================

  server.tool(
    "move_ticket",
    "Move a ticket to a different workflow stage. Valid transitions: INBOX→SPECIFY/BUILD, SPECIFY→PLAN, PLAN→BUILD, BUILD→VERIFY/INBOX, VERIFY→SHIP/PLAN",
    {
      projectId: z.number().int().positive().describe("Project ID the ticket belongs to"),
      ticketKey: z
        .string()
        .regex(/^[A-Z]{3,6}-\d+$/)
        .describe("Ticket key (e.g., 'AIB-123')"),
      targetStage: z
        .enum(["INBOX", "SPECIFY", "PLAN", "BUILD", "VERIFY", "SHIP"])
        .describe("Target stage to transition to"),
    },
    ({ projectId, ticketKey, targetStage }) =>
      handleToolCall(
        () => moveTicket(config, { projectId, ticketKey, targetStage }),
        (result) => `Moved ${ticketKey} to ${result.stage}\n\n${JSON.stringify(result, null, 2)}`
      )
  );

  return server;
}
