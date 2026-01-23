/**
 * Unit Tests: MCP Server Config
 *
 * Tests the configuration loading and validation utilities.
 * - Config path resolution
 * - Zod schema validation
 *
 * Note: loadConfig is tested separately via integration tests since
 * mocking fs in ESM with vitest requires complex hoisting.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { homedir } from "os";
import { join } from "path";
import { ConfigSchema } from "../../../mcp-server/src/config";

// We test getConfigPath by testing its behavior through env vars
// The actual file loading is tested in integration tests

describe("MCP Server Config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getConfigPath", () => {
    it("should return default path when AIBOARD_CONFIG_PATH is not set", async () => {
      delete process.env["AIBOARD_CONFIG_PATH"];

      // Re-import to get fresh function with new env
      const { getConfigPath } = await import("../../../mcp-server/src/config");
      const path = getConfigPath();

      expect(path).toBe(join(homedir(), ".aiboard", "config.json"));
    });

    it("should return custom path when AIBOARD_CONFIG_PATH is set", async () => {
      process.env["AIBOARD_CONFIG_PATH"] = "/custom/path/config.json";

      const { getConfigPath } = await import("../../../mcp-server/src/config");
      const path = getConfigPath();

      expect(path).toBe("/custom/path/config.json");
    });
  });

  describe("ConfigSchema", () => {
    it("should accept valid config", () => {
      const validConfig = {
        apiUrl: "https://ai-board.vercel.app",
        token: "pat_" + "a".repeat(64),
      };

      const result = ConfigSchema.safeParse(validConfig);

      expect(result.success).toBe(true);
    });

    it("should reject apiUrl with trailing slash", () => {
      const invalidConfig = {
        apiUrl: "https://ai-board.vercel.app/",
        token: "pat_" + "a".repeat(64),
      };

      const result = ConfigSchema.safeParse(invalidConfig);

      expect(result.success).toBe(false);
    });

    it("should reject invalid URL", () => {
      const invalidConfig = {
        apiUrl: "not-a-url",
        token: "pat_" + "a".repeat(64),
      };

      const result = ConfigSchema.safeParse(invalidConfig);

      expect(result.success).toBe(false);
    });

    it("should reject token without pat_ prefix", () => {
      const invalidConfig = {
        apiUrl: "https://ai-board.vercel.app",
        token: "abc_" + "a".repeat(64),
      };

      const result = ConfigSchema.safeParse(invalidConfig);

      expect(result.success).toBe(false);
    });

    it("should reject token with less than 68 characters", () => {
      const invalidConfig = {
        apiUrl: "https://ai-board.vercel.app",
        token: "pat_" + "a".repeat(32), // Only 36 chars total
      };

      const result = ConfigSchema.safeParse(invalidConfig);

      expect(result.success).toBe(false);
    });

    it("should accept localhost URLs", () => {
      const validConfig = {
        apiUrl: "http://localhost:3000",
        token: "pat_" + "a".repeat(64),
      };

      const result = ConfigSchema.safeParse(validConfig);

      expect(result.success).toBe(true);
    });

    it("should reject missing apiUrl", () => {
      const invalidConfig = {
        token: "pat_" + "a".repeat(64),
      };

      const result = ConfigSchema.safeParse(invalidConfig);

      expect(result.success).toBe(false);
    });

    it("should reject missing token", () => {
      const invalidConfig = {
        apiUrl: "https://ai-board.vercel.app",
      };

      const result = ConfigSchema.safeParse(invalidConfig);

      expect(result.success).toBe(false);
    });

    it("should accept token with exactly 68 characters", () => {
      const validConfig = {
        apiUrl: "https://ai-board.vercel.app",
        token: "pat_" + "a".repeat(64), // Exactly 68 chars
      };

      const result = ConfigSchema.safeParse(validConfig);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.token.length).toBe(68);
      }
    });
  });
});
