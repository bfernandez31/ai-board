/**
 * Integration Tests: MCP Server Project Tools
 *
 * Tests the list_projects and get_project tool implementations
 * against the actual ai-board API.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getTestContext, type TestContext } from "@/tests/fixtures/vitest/setup";
import { listProjects } from "../../../mcp-server/src/tools/list-projects";
import { getProject } from "../../../mcp-server/src/tools/get-project";
import type { Config } from "../../../mcp-server/src/config";
import { ApiError, ErrorCode } from "../../../mcp-server/src/errors";

// TODO: Re-enable when MCP_API_URL is configured in test environment
describe.skip("MCP Server Project Tools", () => {
  let ctx: TestContext;
  let testConfig: Config;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    // Create a test config that points to the local API
    testConfig = {
      apiUrl: ctx.api.baseUrl,
      // Use a dummy token format - the test API uses session auth
      token: "pat_" + "a".repeat(64),
    };
  });

  describe("listProjects", () => {
    it("should return array of projects", async () => {
      // Create a test project first
      await ctx.api.post("/api/projects", {
        name: "[e2e] MCP Test Project",
        key: "MCP",
        description: "Test project for MCP server tests",
        githubOwner: "test",
        githubRepo: "test-repo",
      });

      const projects = await listProjects(testConfig);

      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);

      // Verify project structure
      const project = projects.find((p) => p.key === "MCP");
      expect(project).toBeDefined();
      expect(project).toHaveProperty("id");
      expect(project).toHaveProperty("name", "[e2e] MCP Test Project");
      expect(project).toHaveProperty("key", "MCP");
      expect(project).toHaveProperty("description");
      expect(project).toHaveProperty("githubOwner");
      expect(project).toHaveProperty("githubRepo");
      expect(project).toHaveProperty("ticketCount");
      expect(project).toHaveProperty("updatedAt");
    });

    it("should return empty array when no projects exist", async () => {
      // This test relies on the cleanup removing all projects
      // The test user might have access to reserved test projects (1, 2)
      const projects = await listProjects(testConfig);

      expect(Array.isArray(projects)).toBe(true);
    });
  });

  describe("getProject", () => {
    it("should return project details by ID", async () => {
      // Create a test project
      const createResponse = await ctx.api.post<{ id: number }>("/api/projects", {
        name: "[e2e] MCP Get Project Test",
        key: "MGP",
        description: "Test project for get_project",
        githubOwner: "test-owner",
        githubRepo: "test-repo",
      });
      const projectId = createResponse.data.id;

      const project = await getProject(testConfig, projectId);

      expect(project).toHaveProperty("id", projectId);
      expect(project).toHaveProperty("name", "[e2e] MCP Get Project Test");
      expect(project).toHaveProperty("key", "MGP");
      expect(project).toHaveProperty("description", "Test project for get_project");
      expect(project).toHaveProperty("githubOwner", "test-owner");
      expect(project).toHaveProperty("githubRepo", "test-repo");
      expect(project).toHaveProperty("clarificationPolicy");
      expect(project).toHaveProperty("createdAt");
      expect(project).toHaveProperty("updatedAt");
    });

    it("should throw NOT_FOUND error for non-existent project", async () => {
      try {
        await getProject(testConfig, 99999);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it("should include clarificationPolicy in response", async () => {
      // Create a project with specific clarification policy
      const createResponse = await ctx.api.post<{ id: number }>("/api/projects", {
        name: "[e2e] MCP Policy Test",
        key: "MPT",
        description: "Test clarification policy",
        githubOwner: "test",
        githubRepo: "test",
        clarificationPolicy: "CONSERVATIVE",
      });
      const projectId = createResponse.data.id;

      const project = await getProject(testConfig, projectId);

      expect(project.clarificationPolicy).toBe("CONSERVATIVE");
    });
  });
});
