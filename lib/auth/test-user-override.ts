import type { NextRequest } from "next/server"

export const TEST_USER_HEADER = "x-test-user-id"
export const TEST_AUTH_OVERRIDE_HEADER = "x-ai-board-test-auth-override"

export type TestUserOverrideRejectionReason =
  | "not-test-context"
  | "missing-explicit-override"
  | "user-not-found"
  | "disallowed-route"

export interface TestUserOverrideAttempt {
  requestedUserId: string
  route: string
  reason: TestUserOverrideRejectionReason
}

type RequestLike = Pick<NextRequest, "headers" | "nextUrl" | "url"> | Request

export function isRuntimeTestEnvironment(): boolean {
  return process.env.TEST_MODE === "true" || process.env.NODE_ENV === "test"
}

export function isExplicitTestOverrideRequest(headers: Headers): boolean {
  return (
    isRuntimeTestEnvironment() &&
    headers.get(TEST_AUTH_OVERRIDE_HEADER)?.toLowerCase() === "true"
  )
}

export function getRequestPath(request?: RequestLike): string {
  if (!request) {
    return "unknown"
  }

  if ("nextUrl" in request && request.nextUrl?.pathname) {
    return request.nextUrl.pathname
  }

  try {
    return new URL(request.url).pathname
  } catch {
    return "unknown"
  }
}

export function getBlockedTestUserOverrideAttempt(
  headers: Headers,
  request?: RequestLike
): TestUserOverrideAttempt | null {
  const requestedUserId = headers.get(TEST_USER_HEADER)
  if (!requestedUserId) {
    return null
  }

  if (!isRuntimeTestEnvironment()) {
    return {
      requestedUserId,
      route: getRequestPath(request),
      reason: "not-test-context",
    }
  }

  if (!isExplicitTestOverrideRequest(headers)) {
    return {
      requestedUserId,
      route: getRequestPath(request),
      reason: "missing-explicit-override",
    }
  }

  return null
}

