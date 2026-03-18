import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  authorizeDevLogin,
  compareDevLoginSecret,
  getDevLoginFailureRedirect,
} from "@/app/lib/auth/dev-login"
import { createDevLoginCredentials, enabledDevLoginEnv } from "@/tests/unit/auth/dev-login-test-helpers"
import { prisma } from "@/lib/db/client"

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}))

describe("dev-login failure", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.VERCEL_ENV = enabledDevLoginEnv.VERCEL_ENV
    process.env.DEV_LOGIN_ENABLED = enabledDevLoginEnv.DEV_LOGIN_ENABLED
    process.env.DEV_LOGIN_SECRET = enabledDevLoginEnv.DEV_LOGIN_SECRET
  })

  it("rejects invalid email input before provisioning", async () => {
    const user = await authorizeDevLogin(
      createDevLoginCredentials({
        email: "not-an-email",
      }),
    )

    expect(user).toBeNull()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("rejects secret mismatches without provisioning", async () => {
    const user = await authorizeDevLogin(
      createDevLoginCredentials({
        secret: "wrong-secret",
      }),
    )

    expect(user).toBeNull()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("uses timing-safe comparison semantics", () => {
    expect(compareDevLoginSecret("shared-preview-secret", "shared-preview-secret")).toBe(true)
    expect(compareDevLoginSecret("shared-preview-secret", "wrong-secret")).toBe(false)
  })

  it("produces a generic retry redirect", () => {
    expect(getDevLoginFailureRedirect("/projects/123")).toBe(
      "/auth/signin?error=dev-login&callbackUrl=%2Fprojects%2F123",
    )
  })
})
