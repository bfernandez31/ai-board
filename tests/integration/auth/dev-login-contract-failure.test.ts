import { beforeEach, describe, expect, it } from "vitest"
import { createAPIClient } from "@/tests/fixtures/vitest/api-client"
import {
  createDevLoginFormBody,
  getCookieHeader,
  readRedirectLocation,
} from "@/tests/integration/auth/dev-login-test-helpers"

describe("dev-login contract failure", () => {
  const api = createAPIClient({ testUserId: "" })

  beforeEach(() => {
    process.env.VERCEL_ENV = "preview"
    process.env.DEV_LOGIN_ENABLED = "true"
    process.env.DEV_LOGIN_SECRET = "shared-preview-secret"
  })

  it("redirects failed credentials submissions back to the sign-in page", async () => {
    const csrfResponse = await api.fetch("/api/auth/csrf")
    const cookie = getCookieHeader(csrfResponse)
    const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string }

    const response = await api.fetch("/api/auth/callback/credentials", {
      method: "POST",
      body: createDevLoginFormBody({
        csrfToken,
        secret: "wrong-secret",
      }),
      redirect: "manual",
      headers: {
        cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })

    expect(response.status).toBe(302)
    expect(await readRedirectLocation(response)).toContain("/auth/signin?error=dev-login")
  })
})
