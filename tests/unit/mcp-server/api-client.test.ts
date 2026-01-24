/**
 * Unit Tests: MCP Server API Client
 *
 * Tests the API client utilities.
 * - Request building
 * - Error handling
 * - Timeout behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiRequest } from "../../../mcp-server/src/api-client";
import { ApiError, ErrorCode, McpError } from "../../../mcp-server/src/errors";
import type { Config } from "../../../mcp-server/src/config";

describe("MCP Server API Client", () => {
  const mockConfig: Config = {
    apiUrl: "https://api.example.com",
    token: "pat_" + "a".repeat(64),
  };

  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("apiRequest", () => {
    it("should make request with correct URL and headers", async () => {
      const mockResponse = { data: "test" };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await apiRequest(mockConfig, "/api/test");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/api/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer pat_" + "a".repeat(64),
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should return parsed JSON response", async () => {
      const mockResponse = { id: 1, name: "test" };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiRequest<typeof mockResponse>(
        mockConfig,
        "/api/test"
      );

      expect(result).toEqual(mockResponse);
    });

    it("should pass through custom options", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiRequest(mockConfig, "/api/test", {
        method: "POST",
        body: JSON.stringify({ title: "Test" }),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "Test" }),
        })
      );
    });

    it("should throw ApiError with AUTH_FAILED for 401 response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      await expect(apiRequest(mockConfig, "/api/test")).rejects.toThrow(
        ApiError
      );

      try {
        await apiRequest(mockConfig, "/api/test");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe(ErrorCode.AUTH_FAILED);
        expect((error as ApiError).status).toBe(401);
      }
    });

    it("should throw ApiError with ACCESS_DENIED for 403 response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      });

      try {
        await apiRequest(mockConfig, "/api/test");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe(ErrorCode.ACCESS_DENIED);
        expect((error as ApiError).status).toBe(403);
      }
    });

    it("should throw ApiError with NOT_FOUND for 404 response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not found"),
      });

      try {
        await apiRequest(mockConfig, "/api/test");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe(ErrorCode.NOT_FOUND);
        expect((error as ApiError).status).toBe(404);
      }
    });

    it("should throw ApiError with RATE_LIMITED for 429 response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve(JSON.stringify({ retryAfter: 60 })),
      });

      try {
        await apiRequest(mockConfig, "/api/test");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe(ErrorCode.RATE_LIMITED);
        expect((error as ApiError).message).toContain("60 seconds");
      }
    });

    it("should throw McpError with NETWORK_ERROR for fetch failures", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      try {
        await apiRequest(mockConfig, "/api/test");
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(ErrorCode.NETWORK_ERROR);
      }
    });

    it("should parse validation errors from 422 response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: () =>
          Promise.resolve(JSON.stringify({ error: "Title is required" })),
      });

      try {
        await apiRequest(mockConfig, "/api/test");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe(ErrorCode.VALIDATION_ERROR);
        expect((error as ApiError).message).toContain("Title is required");
      }
    });

    it("should parse error message from generic error responses", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () =>
          Promise.resolve(JSON.stringify({ error: "Internal server error" })),
      });

      try {
        await apiRequest(mockConfig, "/api/test");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toContain("Internal server error");
      }
    });
  });
});

describe("ApiError", () => {
  describe("fromStatus", () => {
    it("should create AUTH_FAILED error for 401", () => {
      const error = ApiError.fromStatus(401, "");

      expect(error.code).toBe(ErrorCode.AUTH_FAILED);
      expect(error.status).toBe(401);
    });

    it("should create ACCESS_DENIED error for 403", () => {
      const error = ApiError.fromStatus(403, "");

      expect(error.code).toBe(ErrorCode.ACCESS_DENIED);
      expect(error.status).toBe(403);
    });

    it("should create NOT_FOUND error for 404", () => {
      const error = ApiError.fromStatus(404, "");

      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.status).toBe(404);
    });

    it("should create RATE_LIMITED error for 429", () => {
      const error = ApiError.fromStatus(429, "");

      expect(error.code).toBe(ErrorCode.RATE_LIMITED);
      expect(error.status).toBe(429);
    });

    it("should create API_ERROR for unknown status codes", () => {
      const error = ApiError.fromStatus(503, "");

      expect(error.code).toBe(ErrorCode.API_ERROR);
      expect(error.status).toBe(503);
    });
  });
});
