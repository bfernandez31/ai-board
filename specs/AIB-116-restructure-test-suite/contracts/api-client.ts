/**
 * API Client Contract for Vitest Integration Tests
 *
 * This interface defines the contract for the API client used in integration tests.
 * Implementation: tests/fixtures/vitest/api-client.ts
 */

export interface APIClientConfig {
  /** Base URL for API requests (default: http://localhost:3000) */
  baseUrl?: string;
  /** Test user ID for x-test-user-id header */
  testUserId?: string;
  /** Additional headers to include in all requests */
  defaultHeaders?: Record<string, string>;
}

export interface APIResponse<T = unknown> {
  /** HTTP status code */
  status: number;
  /** Indicates if request was successful (2xx) */
  ok: boolean;
  /** Parsed JSON body */
  data: T;
  /** Raw Response object for advanced use */
  response: Response;
}

export interface APIClient {
  /**
   * GET request with authentication
   * @param path - API path (e.g., '/api/projects/1/tickets')
   */
  get<T = unknown>(path: string): Promise<APIResponse<T>>;

  /**
   * POST request with JSON body
   * @param path - API path
   * @param body - Request body (will be JSON.stringify'd)
   */
  post<T = unknown>(path: string, body?: unknown): Promise<APIResponse<T>>;

  /**
   * PATCH request with JSON body
   * @param path - API path
   * @param body - Request body
   */
  patch<T = unknown>(path: string, body?: unknown): Promise<APIResponse<T>>;

  /**
   * DELETE request with authentication
   * @param path - API path
   */
  delete<T = unknown>(path: string): Promise<APIResponse<T>>;

  /**
   * Raw fetch with auth headers
   * @param path - API path
   * @param options - Fetch options (headers will be merged)
   */
  fetch(path: string, options?: RequestInit): Promise<Response>;
}

/**
 * Create an API client instance
 * @param config - Client configuration
 */
export type CreateAPIClient = (config?: APIClientConfig) => APIClient;
