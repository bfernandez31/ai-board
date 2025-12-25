/**
 * API Client for Vitest Integration Tests
 *
 * Provides a fetch wrapper with authentication headers for testing API endpoints.
 * Implementation of: specs/AIB-116-restructure-test-suite/contracts/api-client.ts
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

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_TEST_USER_ID = 'test-user-id';

/**
 * Create an API client instance
 * @param config - Client configuration
 */
export function createAPIClient(config?: APIClientConfig): APIClient {
  const baseUrl = config?.baseUrl ?? process.env.TEST_BASE_URL ?? DEFAULT_BASE_URL;
  const testUserId = config?.testUserId ?? process.env.TEST_USER_ID ?? DEFAULT_TEST_USER_ID;
  const defaultHeaders = config?.defaultHeaders ?? {};

  const getHeaders = (additionalHeaders?: HeadersInit): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
    };

    // Only add auth header if testUserId is provided
    if (testUserId) {
      headers['x-test-user-id'] = testUserId;
    }

    // Merge additional headers
    if (additionalHeaders) {
      if (additionalHeaders instanceof Headers) {
        additionalHeaders.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(additionalHeaders)) {
        additionalHeaders.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, additionalHeaders);
      }
    }

    return headers;
  };

  const makeRequest = async <T>(
    path: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> => {
    const url = `${baseUrl}${path}`;
    const headers = getHeaders(options.headers);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    let data: T;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = {} as T;
      }
    } else {
      data = {} as T;
    }

    return {
      status: response.status,
      ok: response.ok,
      data,
      response,
    };
  };

  return {
    get: <T>(path: string) => makeRequest<T>(path, { method: 'GET' }),

    post: <T>(path: string, body?: unknown) =>
      makeRequest<T>(path, {
        method: 'POST',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),

    patch: <T>(path: string, body?: unknown) =>
      makeRequest<T>(path, {
        method: 'PATCH',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),

    delete: <T>(path: string) => makeRequest<T>(path, { method: 'DELETE' }),

    fetch: (path: string, options?: RequestInit) => {
      const url = `${baseUrl}${path}`;
      const headers = getHeaders(options?.headers);
      return fetch(url, { ...options, headers });
    },
  };
}

// Export a default client instance for convenience
export const defaultClient = createAPIClient();
