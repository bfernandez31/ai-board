/**
 * Integration Tests: MCP Server Ticket Tools
 *
 * Tests the list_tickets and get_ticket tool implementations
 * against the actual ai-board API.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getTestContext, type TestContext } from "@/tests/fixtures/vitest/setup";
import { listTickets } from "../../../mcp-server/src/tools/list-tickets";
import { getTicket } from "../../../mcp-server/src/tools/get-ticket";
import type { Config } from "../../../mcp-server/src/config";
import type { TicketsByStage, TicketSummary } from "../../../mcp-server/src/types";
import { ApiError, ErrorCode } from "../../../mcp-server/src/errors";

// TODO: Re-enable when MCP_API_URL is configured in test environment
describe.skip("MCP Server Ticket Tools", () => {
  let ctx: TestContext;
  let testConfig: Config;
  let projectId: number;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    // Create a test config that points to the local API
    testConfig = {
      apiUrl: ctx.api.baseUrl,
      token: "pat_" + "a".repeat(64),
    };

    // Create a test project for ticket operations
    const projectResponse = await ctx.api.post<{ id: number }>("/api/projects", {
      name: "[e2e] MCP Tickets Test",
      key: "MCT",
      description: "Test project for MCP ticket tests",
      githubOwner: "test",
      githubRepo: "test-repo",
    });
    projectId = projectResponse.data.id;
  });

  describe("listTickets", () => {
    it("should return tickets grouped by stage", async () => {
      // Create a test ticket
      await ctx.api.post(`/api/projects/${projectId}/tickets`, {
        title: "[e2e] MCP Test Ticket",
        description: "Test ticket for list_tickets",
      });

      const tickets = await listTickets(testConfig, projectId);

      // Should return all stages
      expect(tickets).toHaveProperty("INBOX");
      expect(tickets).toHaveProperty("SPECIFY");
      expect(tickets).toHaveProperty("PLAN");
      expect(tickets).toHaveProperty("BUILD");
      expect(tickets).toHaveProperty("VERIFY");
      expect(tickets).toHaveProperty("SHIP");

      // New ticket should be in INBOX
      const ticketsByStage = tickets as TicketsByStage;
      expect(ticketsByStage.INBOX.length).toBeGreaterThan(0);

      const ticket = ticketsByStage.INBOX[0];
      expect(ticket).toHaveProperty("id");
      expect(ticket).toHaveProperty("ticketKey");
      expect(ticket).toHaveProperty("title", "[e2e] MCP Test Ticket");
      expect(ticket).toHaveProperty("stage", "INBOX");
    });

    it("should filter by stage when specified", async () => {
      // Create a test ticket
      await ctx.api.post(`/api/projects/${projectId}/tickets`, {
        title: "[e2e] MCP Stage Filter Test",
        description: "Test ticket for stage filter",
      });

      const inboxTickets = await listTickets(testConfig, projectId, "INBOX");

      // Should return array (not object) when stage is specified
      expect(Array.isArray(inboxTickets)).toBe(true);
      const tickets = inboxTickets as TicketSummary[];
      expect(tickets.length).toBeGreaterThan(0);

      // All tickets should be in INBOX stage
      for (const ticket of tickets) {
        expect(ticket.stage).toBe("INBOX");
      }
    });

    it("should return empty arrays for stages with no tickets", async () => {
      const tickets = await listTickets(testConfig, projectId);

      // SHIP stage should be empty for new project
      const ticketsByStage = tickets as TicketsByStage;
      expect(ticketsByStage.SHIP).toEqual([]);
    });

    it("should throw NOT_FOUND error for non-existent project", async () => {
      try {
        await listTickets(testConfig, 99999);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe(ErrorCode.NOT_FOUND);
      }
    });
  });

  describe("getTicket", () => {
    it("should return ticket details by key", async () => {
      // Create a test ticket
      const createResponse = await ctx.api.post<{ ticketKey: string }>(
        `/api/projects/${projectId}/tickets`,
        {
          title: "[e2e] MCP Get Ticket Test",
          description: "Test ticket for get_ticket",
        }
      );
      const ticketKey = createResponse.data.ticketKey;

      const ticket = await getTicket(testConfig, projectId, ticketKey);

      expect(ticket).toHaveProperty("ticketKey", ticketKey);
      expect(ticket).toHaveProperty("title", "[e2e] MCP Get Ticket Test");
      expect(ticket).toHaveProperty("description", "Test ticket for get_ticket");
      expect(ticket).toHaveProperty("stage", "INBOX");
      expect(ticket).toHaveProperty("version");
      expect(ticket).toHaveProperty("workflowType");
      expect(ticket).toHaveProperty("project");
      expect(ticket.project).toHaveProperty("id", projectId);
    });

    it("should throw NOT_FOUND error for non-existent ticket", async () => {
      try {
        await getTicket(testConfig, projectId, "MCT-99999");
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it("should include branch when ticket has one", async () => {
      // Create a ticket - by default it won't have a branch
      const createResponse = await ctx.api.post<{ ticketKey: string }>(
        `/api/projects/${projectId}/tickets`,
        {
          title: "[e2e] MCP Branch Test",
          description: "Test ticket branch",
        }
      );
      const ticketKey = createResponse.data.ticketKey;

      const ticket = await getTicket(testConfig, projectId, ticketKey);

      // New tickets don't have branches - branch is created when moving to BUILD
      expect(ticket).toHaveProperty("branch");
      expect(ticket.branch).toBeNull();
    });
  });
});
