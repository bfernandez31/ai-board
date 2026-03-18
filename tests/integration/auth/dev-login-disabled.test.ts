import { beforeEach, describe, expect, it } from "vitest"
import { authorizeDevLogin } from "@/app/lib/auth/dev-login"
import { createDevLoginCredentials } from "@/tests/unit/auth/dev-login-test-helpers"

describe("dev-login disabled behavior", () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = "production"
    process.env.DEV_LOGIN_ENABLED = "false"
    process.env.DEV_LOGIN_SECRET = ""
  })

  it("rejects direct credentials attempts when the gate is off", async () => {
    const user = await authorizeDevLogin(createDevLoginCredentials())

    expect(user).toBeNull()
  })
})
