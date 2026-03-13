/**
 * Integration Tests: Project API Keys (BYOK)
 *
 * Tests for the BYOK API key management endpoints:
 * - GET /api/projects/:id/api-keys (list masked keys)
 * - PUT /api/projects/:id/api-keys (upsert key)
 * - DELETE /api/projects/:id/api-keys (remove key)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getTestContext,
  type TestContext,
} from "@/tests/fixtures/vitest/setup";
import { getPrismaClient } from "@/tests/helpers/db-cleanup";

describe("Project API Keys (BYOK)", () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  /** PUT helper since APIClient doesn't have a put method */
  async function putApiKey<T = unknown>(
    path: string,
    body: unknown
  ): Promise<{ status: number; data: T }> {
    const response = await ctx.api.fetch(path, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as T;
    return { status: response.status, data };
  }

  /** DELETE helper with body */
  async function deleteApiKey(
    path: string,
    body: unknown
  ): Promise<{ status: number; data: unknown }> {
    const response = await ctx.api.fetch(path, {
      method: "DELETE",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return { status: response.status, data };
  }

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // Clean up any leftover API keys for the test project
    await prisma.projectApiKey.deleteMany({
      where: { projectId: ctx.projectId },
    });
  });

  describe("GET /api/projects/:id/api-keys", () => {
    it("should return empty array when no keys configured", async () => {
      const response = await ctx.api.get<{
        apiKeys: Array<{ provider: string; preview: string }>;
      }>(`/api/projects/${ctx.projectId}/api-keys`);

      expect(response.status).toBe(200);
      expect(response.data.apiKeys).toEqual([]);
    });

    it("should return masked key info after saving", async () => {
      await putApiKey(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: "ANTHROPIC",
        key: "sk-ant-api03-test-key-1234567890",
      });

      const response = await ctx.api.get<{
        apiKeys: Array<{
          id: number;
          provider: string;
          preview: string;
          createdAt: string;
          updatedAt: string;
        }>;
      }>(`/api/projects/${ctx.projectId}/api-keys`);

      expect(response.status).toBe(200);
      expect(response.data.apiKeys).toHaveLength(1);
      expect(response.data.apiKeys[0].provider).toBe("ANTHROPIC");
      expect(response.data.apiKeys[0].preview).toBe("7890");
      expect(response.data.apiKeys[0]).not.toHaveProperty("encryptedKey");
      expect(response.data.apiKeys[0]).not.toHaveProperty("iv");
      expect(response.data.apiKeys[0]).not.toHaveProperty("authTag");
    });

    it("should return 404 for non-existent project", async () => {
      const response = await ctx.api.get<{ error: string }>(
        "/api/projects/99999/api-keys"
      );

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/projects/:id/api-keys", () => {
    it("should create a new ANTHROPIC key", async () => {
      const response = await putApiKey<{
        apiKey: { id: number; provider: string; preview: string };
      }>(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: "ANTHROPIC",
        key: "sk-ant-api03-new-key-abcdefghij",
      });

      expect(response.status).toBe(200);
      expect(response.data.apiKey.provider).toBe("ANTHROPIC");
      expect(response.data.apiKey.preview).toBe("ghij");
    });

    it("should create a new OPENAI key", async () => {
      const response = await putApiKey<{
        apiKey: { provider: string; preview: string };
      }>(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: "OPENAI",
        key: "sk-proj-test-openai-key-1234",
      });

      expect(response.status).toBe(200);
      expect(response.data.apiKey.provider).toBe("OPENAI");
      expect(response.data.apiKey.preview).toBe("1234");
    });

    it("should replace an existing key", async () => {
      await putApiKey(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: "ANTHROPIC",
        key: "sk-ant-api03-original-key-abcd",
      });

      const response = await putApiKey<{ apiKey: { preview: string } }>(
        `/api/projects/${ctx.projectId}/api-keys`,
        {
          provider: "ANTHROPIC",
          key: "sk-ant-api03-replacement-key-wxyz",
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.apiKey.preview).toBe("wxyz");

      // Verify only one key exists
      const listResponse = await ctx.api.get<{
        apiKeys: Array<{ provider: string }>;
      }>(`/api/projects/${ctx.projectId}/api-keys`);
      expect(
        listResponse.data.apiKeys.filter((k) => k.provider === "ANTHROPIC")
      ).toHaveLength(1);
    });

    it("should return 400 for too-short key", async () => {
      const response = await putApiKey(
        `/api/projects/${ctx.projectId}/api-keys`,
        { provider: "ANTHROPIC", key: "short" }
      );

      expect(response.status).toBe(400);
    });

    it("should return 400 for invalid provider", async () => {
      const response = await putApiKey(
        `/api/projects/${ctx.projectId}/api-keys`,
        { provider: "INVALID", key: "sk-ant-api03-some-valid-key" }
      );

      expect(response.status).toBe(400);
    });

    it("should support both providers simultaneously", async () => {
      await putApiKey(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: "ANTHROPIC",
        key: "sk-ant-api03-anthropic-key-aaaa",
      });
      await putApiKey(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: "OPENAI",
        key: "sk-proj-openai-key-bbbbbbbbbb",
      });

      const response = await ctx.api.get<{
        apiKeys: Array<{ provider: string }>;
      }>(`/api/projects/${ctx.projectId}/api-keys`);

      expect(response.data.apiKeys).toHaveLength(2);
      const providers = response.data.apiKeys.map((k) => k.provider).sort();
      expect(providers).toEqual(["ANTHROPIC", "OPENAI"]);
    });
  });

  describe("DELETE /api/projects/:id/api-keys", () => {
    it("should delete an existing key", async () => {
      await putApiKey(`/api/projects/${ctx.projectId}/api-keys`, {
        provider: "ANTHROPIC",
        key: "sk-ant-api03-to-delete-key-1234",
      });

      const response = await deleteApiKey(
        `/api/projects/${ctx.projectId}/api-keys`,
        { provider: "ANTHROPIC" }
      );

      expect(response.status).toBe(200);
      expect((response.data as { success: boolean }).success).toBe(true);

      // Verify it's gone
      const listResponse = await ctx.api.get<{
        apiKeys: Array<{ provider: string }>;
      }>(`/api/projects/${ctx.projectId}/api-keys`);
      expect(listResponse.data.apiKeys).toHaveLength(0);
    });

    it("should return 400 for invalid provider", async () => {
      const response = await deleteApiKey(
        `/api/projects/${ctx.projectId}/api-keys`,
        { provider: "INVALID" }
      );

      expect(response.status).toBe(400);
    });
  });
});
