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
  /** Whether to include the default x-test-user-id header */
  includeTestUserHeader?: boolean;
  /** Whether to include the explicit test auth override header */
  enableTestAuthOverride?: boolean;
  /** Additional headers to include in all requests */
  defaultHeaders?: Record<string, string>;
}

export interface APIRequestOptions extends Omit<RequestInit, 'body'> {
  /** Override the test user header for a single request */
  testUserId?: string | null;
  /** Include x-test-user-id for this request */
  includeTestUserHeader?: boolean;
  /** Include explicit test override header for this request */
  enableTestAuthOverride?: boolean;
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
  get<T = unknown>(path: string, options?: APIRequestOptions): Promise<APIResponse<T>>;

  /**
   * POST request with JSON body
   * @param path - API path
   * @param body - Request body (will be JSON.stringify'd)
   */
  post<T = unknown>(
    path: string,
    body?: unknown,
    options?: APIRequestOptions
  ): Promise<APIResponse<T>>;

  /**
   * PATCH request with JSON body
   * @param path - API path
   * @param body - Request body
   */
  patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: APIRequestOptions
  ): Promise<APIResponse<T>>;

  /**
   * DELETE request with authentication
   * @param path - API path
   */
  delete<T = unknown>(path: string, options?: APIRequestOptions): Promise<APIResponse<T>>;

  /**
   * Raw fetch with auth headers
   * @param path - API path
   * @param options - Fetch options (headers will be merged)
   */
  fetch(path: string, options?: APIRequestOptions): Promise<Response>;
}

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_TEST_USER_ID = 'test-user-id';
export const TEST_USER_HEADER = 'x-test-user-id';
export const TEST_AUTH_OVERRIDE_HEADER = 'x-ai-board-test-auth-override';

/**
 * Create an API client instance
 * @param config - Client configuration
 */
export function createAPIClient(config?: APIClientConfig): APIClient {
  const baseUrl = config?.baseUrl ?? process.env.TEST_BASE_URL ?? DEFAULT_BASE_URL;
  const testUserId = config?.testUserId ?? process.env.TEST_USER_ID ?? DEFAULT_TEST_USER_ID;
  const includeDefaultTestUserHeader = config?.includeTestUserHeader ?? Boolean(testUserId);
  const enableDefaultTestAuthOverride =
    config?.enableTestAuthOverride ?? includeDefaultTestUserHeader;
  const defaultHeaders = config?.defaultHeaders ?? {};

  const getHeaders = (options: APIRequestOptions = {}): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
    };

    const requestTestUserId = options.testUserId === undefined ? testUserId : options.testUserId;
    const includeTestUserHeader =
      options.includeTestUserHeader ?? includeDefaultTestUserHeader;
    const enableTestAuthOverride =
      options.enableTestAuthOverride ?? enableDefaultTestAuthOverride;

    if (includeTestUserHeader && requestTestUserId) {
      headers[TEST_USER_HEADER] = requestTestUserId;
    }

    if (enableTestAuthOverride) {
      headers[TEST_AUTH_OVERRIDE_HEADER] = 'true';
    }

    // Merge additional headers
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    return headers;
  };

  const makeRequest = async <T>(
    path: string,
    options: APIRequestOptions = {}
  ): Promise<APIResponse<T>> => {
    const url = `${baseUrl}${path}`;
    const headers = getHeaders(options);

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
    get: <T>(path: string, options?: APIRequestOptions) =>
      makeRequest<T>(path, { ...options, method: 'GET' }),

    post: <T>(path: string, body?: unknown, options?: APIRequestOptions) =>
      makeRequest<T>(path, {
        ...options,
        method: 'POST',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),

    patch: <T>(path: string, body?: unknown, options?: APIRequestOptions) =>
      makeRequest<T>(path, {
        ...options,
        method: 'PATCH',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),

    delete: <T>(path: string, options?: APIRequestOptions) =>
      makeRequest<T>(path, { ...options, method: 'DELETE' }),

    fetch: (path: string, options?: APIRequestOptions) => {
      const url = `${baseUrl}${path}`;
      const headers = getHeaders(options);
      return fetch(url, { ...options, headers });
    },
  };
}

// Export a default client instance for convenience
export const defaultClient = createAPIClient();
