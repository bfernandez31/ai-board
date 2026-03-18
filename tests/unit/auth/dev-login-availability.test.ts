import { beforeEach, describe, expect, it } from "vitest"
import { getDevLoginAvailability, isDevLoginEnabled } from "@/app/lib/auth/dev-login"
import { disabledDevLoginEnv, enabledDevLoginEnv } from "@/tests/unit/auth/dev-login-test-helpers"

describe("dev-login availability", () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = disabledDevLoginEnv.VERCEL_ENV
    process.env.DEV_LOGIN_ENABLED = disabledDevLoginEnv.DEV_LOGIN_ENABLED
    process.env.DEV_LOGIN_SECRET = disabledDevLoginEnv.DEV_LOGIN_SECRET
  })

  it("enables preview login only for preview deployments with explicit config", () => {
    const availability = getDevLoginAvailability(enabledDevLoginEnv)

    expect(availability.enabled).toBe(true)
    expect(isDevLoginEnabled(enabledDevLoginEnv)).toBe(true)
  })

  it("disables login in production", () => {
    const availability = getDevLoginAvailability({
      ...enabledDevLoginEnv,
      VERCEL_ENV: "production",
    })

    expect(availability.enabled).toBe(false)
  })

  it("disables login when the feature flag is off", () => {
    expect(
      isDevLoginEnabled({
        ...enabledDevLoginEnv,
        DEV_LOGIN_ENABLED: "false",
      }),
    ).toBe(false)
  })

  it("disables login when the shared secret is missing", () => {
    expect(
      isDevLoginEnabled({
        ...enabledDevLoginEnv,
        DEV_LOGIN_SECRET: "",
      }),
    ).toBe(false)
  })
})
