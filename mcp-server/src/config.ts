import { homedir } from "os";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { z } from "zod";

/**
 * Zod schema for validating ai-board MCP server configuration
 */
export const ConfigSchema = z.object({
  apiUrl: z
    .string()
    .url("apiUrl must be a valid URL")
    .refine(
      (url) => !url.endsWith("/"),
      "apiUrl should not end with a trailing slash"
    ),
  token: z
    .string()
    .startsWith("pat_", "Token must start with 'pat_'")
    .min(68, "Token must be at least 68 characters (pat_ + 64 hex chars)"),
});

/**
 * Validated configuration type
 */
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Get the path to the configuration file.
 * Uses AIBOARD_CONFIG_PATH environment variable if set,
 * otherwise defaults to ~/.aiboard/config.json
 */
export function getConfigPath(): string {
  const envPath = process.env["AIBOARD_CONFIG_PATH"];
  if (envPath) {
    return envPath;
  }
  return join(homedir(), ".aiboard", "config.json");
}

/**
 * Load and validate configuration from the config file.
 * @throws Error if config file is missing or invalid
 */
export function loadConfig(): Config {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${configPath}. Create it with apiUrl and token.`
    );
  }

  let content: string;
  try {
    content = readFileSync(configPath, "utf-8");
  } catch {
    throw new Error(`Unable to read config file at ${configPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(
      `Invalid JSON in config file at ${configPath}. Ensure it contains valid JSON.`
    );
  }

  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid config: ${issues}`);
  }

  return result.data;
}
