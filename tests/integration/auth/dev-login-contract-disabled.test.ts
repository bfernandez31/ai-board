import { beforeEach, describe, expect, it } from "vitest"
import { createAPIClient } from "@/tests/fixtures/vitest/api-client"
import {
  createDevLoginFormBody,
  getCookieHeader,
  readRedirectLocation,
} from "@/tests/integration/auth/dev-login-test-helpers"

// These tests require the server to run WITHOUT dev-login env vars.
// The integration test server starts with DEV_LOGIN_ENABLED=true, so skip.
// Dev-login availability is covered by unit tests in tests/unit/auth/.
describe.skip("dev-login contract disabled", () => {
  const api = createAPIClient({ testUserId: "" })

  beforeEach(() => {
    process.env.VERCEL_ENV = "production"
    process.env.DEV_LOGIN_ENABLED = "false"
    process.env.DEV_LOGIN_SECRET = ""
  })

  it("keeps the sign-in page free of preview login controls", async () => {
    const response = await api.fetch("/auth/signin")
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).not.toContain("Shared secret")
    expect(body).not.toContain("Continue with Preview Login")
  })

  it("rejects direct credentials callbacks when preview login is disabled", async () => {
    const csrfResponse = await api.fetch("/api/auth/csrf")
    const cookie = getCookieHeader(csrfResponse)
    const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string }

    const response = await api.fetch("/api/auth/callback/credentials", {
      method: "POST",
      body: createDevLoginFormBody({ csrfToken }),
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
