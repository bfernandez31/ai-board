/**
 * Error codes for the MCP server
 */
export enum ErrorCode {
  CONFIG_NOT_FOUND = "CONFIG_NOT_FOUND",
  CONFIG_INVALID = "CONFIG_INVALID",
  AUTH_FAILED = "AUTH_FAILED",
  ACCESS_DENIED = "ACCESS_DENIED",
  NOT_FOUND = "NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  RATE_LIMITED = "RATE_LIMITED",
  NETWORK_ERROR = "NETWORK_ERROR",
  API_ERROR = "API_ERROR",
  ACTIVE_JOB = "ACTIVE_JOB",
  CLEANUP_IN_PROGRESS = "CLEANUP_IN_PROGRESS",
}

/**
 * Base class for MCP server errors
 */
export class McpError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = "McpError";
  }
}

/**
 * Error thrown when API request fails
 */
export class ApiError extends McpError {
  constructor(
    public readonly status: number,
    message: string,
    code?: ErrorCode
  ) {
    super(code ?? ErrorCode.API_ERROR, message);
    this.name = "ApiError";
  }

  /**
   * Create an ApiError from an HTTP status code
   */
  static fromStatus(status: number, body: string): ApiError {
    switch (status) {
      case 401:
        return new ApiError(
          status,
          "Authentication failed. Token may be expired or revoked.",
          ErrorCode.AUTH_FAILED
        );
      case 403:
        return new ApiError(
          status,
          "Access denied to this resource.",
          ErrorCode.ACCESS_DENIED
        );
      case 404:
        return new ApiError(
          status,
          "Resource not found.",
          ErrorCode.NOT_FOUND
        );
      case 422: {
        // Try to parse validation error from body
        try {
          const parsed = JSON.parse(body) as { error?: string };
          if (parsed.error) {
            return new ApiError(status, parsed.error, ErrorCode.VALIDATION_ERROR);
          }
        } catch {
          // Ignore parse errors
        }
        return new ApiError(
          status,
          "Validation error.",
          ErrorCode.VALIDATION_ERROR
        );
      }
      case 429: {
        // Try to extract retry-after from body
        try {
          const parsed = JSON.parse(body) as { retryAfter?: number };
          const retryAfter = parsed.retryAfter;
          if (retryAfter) {
            return new ApiError(
              status,
              `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
              ErrorCode.RATE_LIMITED
            );
          }
        } catch {
          // Ignore parse errors
        }
        return new ApiError(
          status,
          "Rate limit exceeded.",
          ErrorCode.RATE_LIMITED
        );
      }
      default: {
        // Try to parse error message from body
        try {
          const parsed = JSON.parse(body) as { error?: string };
          if (parsed.error) {
            return new ApiError(status, `API error: ${parsed.error}`);
          }
        } catch {
          // Ignore parse errors
        }
        return new ApiError(status, `API error: HTTP ${status}`);
      }
    }
  }
}

/**
 * Format an error for MCP tool response.
 * Ensures no sensitive information is leaked.
 */
export function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof McpError) {
    return error.message;
  }
  if (error instanceof Error) {
    // Ensure token values are not exposed in error messages
    const message = error.message;
    if (message.includes("pat_")) {
      return "An error occurred. Please check your configuration.";
    }
    return message;
  }
  return "An unknown error occurred.";
}
