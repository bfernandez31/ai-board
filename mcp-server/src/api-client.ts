import type { Config } from "./config.js";
import { ApiError, ErrorCode, McpError } from "./errors.js";

/**
 * Default timeout for API requests (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Make an API request to the ai-board API.
 *
 * @param config - The configuration with API URL and token
 * @param endpoint - The API endpoint (e.g., "/api/projects")
 * @param options - Additional fetch options
 * @returns The parsed JSON response
 * @throws ApiError if the request fails
 */
export async function apiRequest<T>(
  config: Config,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const response = await fetch(`${config.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw ApiError.fromStatus(response.status, body);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new McpError(
          ErrorCode.NETWORK_ERROR,
          `Request timed out after ${DEFAULT_TIMEOUT / 1000} seconds`
        );
      }
      // Handle fetch errors (network issues, DNS, etc.)
      throw new McpError(
        ErrorCode.NETWORK_ERROR,
        `Unable to connect to ai-board API at ${config.apiUrl}`
      );
    }
    throw new McpError(ErrorCode.NETWORK_ERROR, "An unknown network error occurred");
  } finally {
    clearTimeout(timeout);
  }
}
