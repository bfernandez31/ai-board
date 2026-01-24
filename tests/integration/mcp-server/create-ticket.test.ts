/**
 * Integration Tests: MCP Server Create Ticket Tool
 *
 * Tests the create_ticket tool implementation
 * against the actual ai-board API.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getTestContext, type TestContext } from "@/tests/fixtures/vitest/setup";
import { createTicket } from "../../../mcp-server/src/tools/create-ticket";
import { listTickets } from "../../../mcp-server/src/tools/list-tickets";
import type { Config } from "../../../mcp-server/src/config";
import type { TicketsByStage } from "../../../mcp-server/src/types";
import { ApiError, ErrorCode } from "../../../mcp-server/src/errors";

describe("MCP Server Create Ticket Tool", () => {
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

    // Create a test project
    const projectResponse = await ctx.api.post<{ id: number }>("/api/projects", {
      name: "[e2e] MCP Create Ticket Test",
      key: "CCT",
      description: "Test project for create_ticket",
      githubOwner: "test",
      githubRepo: "test-repo",
    });
    projectId = projectResponse.data.id;
  });

  describe("createTicket", () => {
    it("should create a ticket with valid input", async () => {
      const ticket = await createTicket(testConfig, {
        projectId,
        title: "[e2e] MCP Created Ticket",
        description: "This ticket was created by the MCP server",
      });

      expect(ticket).toHaveProperty("id");
      expect(ticket).toHaveProperty("ticketKey");
      expect(ticket.ticketKey).toMatch(/^CCT-\d+$/);
      expect(ticket).toHaveProperty("title", "[e2e] MCP Created Ticket");
      expect(ticket).toHaveProperty("description", "This ticket was created by the MCP server");
      expect(ticket).toHaveProperty("stage", "INBOX");
      expect(ticket).toHaveProperty("version");
      expect(ticket).toHaveProperty("createdAt");
    });

    it("should create ticket in INBOX stage", async () => {
      const ticket = await createTicket(testConfig, {
        projectId,
        title: "[e2e] MCP Inbox Test",
        description: "Should appear in INBOX",
      });

      // Verify ticket appears in INBOX
      const tickets = await listTickets(testConfig, projectId);
      const ticketsByStage = tickets as TicketsByStage;

      const inboxTicket = ticketsByStage.INBOX.find((t) => t.ticketKey === ticket.ticketKey);
      expect(inboxTicket).toBeDefined();
      expect(inboxTicket?.stage).toBe("INBOX");
    });

    it("should accept title at max length (100 characters)", async () => {
      const longTitle = "[e2e] " + "x".repeat(94); // Total 100 chars

      const ticket = await createTicket(testConfig, {
        projectId,
        title: longTitle,
        description: "Test long title",
      });

      expect(ticket.title).toBe(longTitle);
    });

    it("should accept description at max length (10000 characters)", async () => {
      const longDescription = "x".repeat(10000);

      const ticket = await createTicket(testConfig, {
        projectId,
        title: "[e2e] Long Description Test",
        description: longDescription,
      });

      expect(ticket.description).toBe(longDescription);
    });

    it("should throw NOT_FOUND error for non-existent project", async () => {
      try {
        await createTicket(testConfig, {
          projectId: 99999,
          title: "[e2e] Invalid Project",
          description: "Should fail",
        });
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it("should support Markdown in description", async () => {
      const markdownDescription = `
# Feature Description

This is a **bold** statement and this is *italic*.

## Steps
1. First step
2. Second step
3. Third step

\`\`\`javascript
const code = "example";
\`\`\`
      `.trim();

      const ticket = await createTicket(testConfig, {
        projectId,
        title: "[e2e] Markdown Test",
        description: markdownDescription,
      });

      expect(ticket.description).toBe(markdownDescription);
    });

    it("should create multiple tickets with unique ticket numbers", async () => {
      const ticket1 = await createTicket(testConfig, {
        projectId,
        title: "[e2e] First Ticket",
        description: "First",
      });

      const ticket2 = await createTicket(testConfig, {
        projectId,
        title: "[e2e] Second Ticket",
        description: "Second",
      });

      // Extract ticket numbers from keys
      const num1 = parseInt(ticket1.ticketKey.split("-")[1] ?? "0", 10);
      const num2 = parseInt(ticket2.ticketKey.split("-")[1] ?? "0", 10);

      expect(num2).toBe(num1 + 1);
    });
  });
});
