/**
 * Integration Tests: MCP Server Move Ticket Tool
 *
 * Tests the move_ticket tool implementation
 * against the actual ai-board API.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getTestContext, type TestContext } from "@/tests/fixtures/vitest/setup";
import { createTicket } from "../../../mcp-server/src/tools/create-ticket";
import { moveTicket } from "../../../mcp-server/src/tools/move-ticket";
import { getTicket } from "../../../mcp-server/src/tools/get-ticket";
import type { Config } from "../../../mcp-server/src/config";
import { ApiError, ErrorCode } from "../../../mcp-server/src/errors";

// TODO: Re-enable when MCP_API_URL is configured in test environment
describe.skip("MCP Server Move Ticket Tool", () => {
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
      name: "[e2e] MCP Move Ticket Test",
      key: "MMT",
      description: "Test project for move_ticket",
      githubOwner: "test",
      githubRepo: "test-repo",
    });
    projectId = projectResponse.data.id;
  });

  describe("moveTicket", () => {
    it("should move ticket from INBOX to SPECIFY", async () => {
      // Create a ticket in INBOX
      const ticket = await createTicket(testConfig, {
        projectId,
        title: "[e2e] MCP Move Test",
        description: "Test ticket for moving",
      });

      // Move to SPECIFY
      const result = await moveTicket(testConfig, {
        projectId,
        ticketKey: ticket.ticketKey,
        targetStage: "SPECIFY",
      });

      expect(result.stage).toBe("SPECIFY");
      expect(result).toHaveProperty("version");
      expect(result).toHaveProperty("updatedAt");

      // Verify ticket is now in SPECIFY
      const updatedTicket = await getTicket(testConfig, projectId, ticket.ticketKey);
      expect(updatedTicket.stage).toBe("SPECIFY");
    });

    it("should return updated version after move", async () => {
      const ticket = await createTicket(testConfig, {
        projectId,
        title: "[e2e] Version Test",
        description: "Test version increment",
      });

      const originalVersion = ticket.version;

      const result = await moveTicket(testConfig, {
        projectId,
        ticketKey: ticket.ticketKey,
        targetStage: "SPECIFY",
      });

      // Version should increment after move
      expect(result.version).toBe(originalVersion + 1);
    });

    it("should throw NOT_FOUND error for non-existent ticket", async () => {
      try {
        await moveTicket(testConfig, {
          projectId,
          ticketKey: "MMT-99999",
          targetStage: "SPECIFY",
        });
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it("should throw error for invalid transition", async () => {
      // Create a ticket in INBOX
      const ticket = await createTicket(testConfig, {
        projectId,
        title: "[e2e] Invalid Transition Test",
        description: "Test invalid transition",
      });

      // Try to move directly to SHIP (invalid from INBOX)
      try {
        await moveTicket(testConfig, {
          projectId,
          ticketKey: ticket.ticketKey,
          targetStage: "SHIP",
        });
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        // API returns 400 for invalid transitions
        expect((error as ApiError).status).toBe(400);
      }
    });

    it("should support sequential stage progression", async () => {
      // Create a ticket
      const ticket = await createTicket(testConfig, {
        projectId,
        title: "[e2e] Sequential Move Test",
        description: "Test sequential progression",
      });

      // Move INBOX -> SPECIFY
      const result1 = await moveTicket(testConfig, {
        projectId,
        ticketKey: ticket.ticketKey,
        targetStage: "SPECIFY",
      });
      expect(result1.stage).toBe("SPECIFY");

      // Move SPECIFY -> PLAN
      const result2 = await moveTicket(testConfig, {
        projectId,
        ticketKey: ticket.ticketKey,
        targetStage: "PLAN",
      });
      expect(result2.stage).toBe("PLAN");
    });

    it("should support quick-impl path (INBOX -> BUILD)", async () => {
      // Create a ticket
      const ticket = await createTicket(testConfig, {
        projectId,
        title: "[e2e] Quick Impl Test",
        description: "Test quick implementation path",
      });

      // Move directly from INBOX to BUILD (quick-impl)
      const result = await moveTicket(testConfig, {
        projectId,
        ticketKey: ticket.ticketKey,
        targetStage: "BUILD",
      });

      expect(result.stage).toBe("BUILD");
      expect(result.workflowType).toBe("QUICK");
    });
  });
});
