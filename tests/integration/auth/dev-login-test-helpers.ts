export interface DevLoginSessionUser {
  id: string
  email: string
  name: string | null
}

export function createDevLoginFormBody(
  overrides: Partial<Record<string, string>> = {},
): URLSearchParams {
  return new URLSearchParams({
    email: "preview.user@example.com",
    secret: "shared-preview-secret",
    redirectTo: "/projects",
    ...overrides,
  })
}

export async function readRedirectLocation(response: Response): Promise<string | null> {
  return response.headers.get("location")
}

export function getCookieHeader(response: Response, fallback?: string): string {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie") as string]
        : []

  const cookieHeader = setCookies
    .map((cookie) => cookie.split(";")[0])
    .join("; ")

  return cookieHeader || fallback || ""
}

export function expectAuthenticatedSessionShape(user: DevLoginSessionUser | undefined) {
  expect(user).toBeDefined()
  expect(user?.id).toBeTruthy()
  expect(user?.email).toMatch(/@/)
}
