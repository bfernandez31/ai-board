import { beforeEach, describe, expect, it } from "vitest"
import { createAPIClient } from "@/tests/fixtures/vitest/api-client"
import {
  createDevLoginFormBody,
  expectAuthenticatedSessionShape,
  getCookieHeader,
  readRedirectLocation,
} from "@/tests/integration/auth/dev-login-test-helpers"

describe("dev-login contract success", () => {
  const api = createAPIClient({ testUserId: "" })

  beforeEach(() => {
    process.env.VERCEL_ENV = "preview"
    process.env.DEV_LOGIN_ENABLED = "true"
    process.env.DEV_LOGIN_SECRET = "shared-preview-secret"
  })

  it("redirects successful credentials callbacks to the requested target", async () => {
    const csrfResponse = await api.fetch("/api/auth/csrf")
    const cookie = getCookieHeader(csrfResponse)
    const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string }
    const formBody = createDevLoginFormBody({
      csrfToken,
      callbackUrl: "/projects",
    })

    const response = await api.fetch("/api/auth/callback/credentials", {
      method: "POST",
      body: formBody,
      redirect: "manual",
      headers: {
        cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })

    expect(response.status).toBe(302)
    expect(await readRedirectLocation(response)).toContain("/projects")
  })

  it("returns an authenticated session payload after successful sign-in", async () => {
    const csrfResponse = await api.fetch("/api/auth/csrf")
    const cookie = getCookieHeader(csrfResponse)
    const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string }
    const response = await api.fetch("/api/auth/callback/credentials", {
      method: "POST",
      body: createDevLoginFormBody({
        csrfToken,
        callbackUrl: "/projects",
      }),
      redirect: "manual",
      headers: {
        cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })

    const sessionCookie = getCookieHeader(response, cookie)
    const sessionResponse = await api.fetch("/api/auth/session", {
      headers: {
        cookie: [cookie, sessionCookie].filter(Boolean).join("; "),
      },
    })

    expect(sessionResponse.status).toBe(200)
    const session = (await sessionResponse.json()) as
      | { user?: { id: string; email: string; name: string | null } }
      | null
    expectAuthenticatedSessionShape(session.user)
  })
})
