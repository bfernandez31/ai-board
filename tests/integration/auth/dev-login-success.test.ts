import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db/client"
import { authorizeDevLogin } from "@/app/lib/auth/dev-login"
import { createDevLoginCredentials } from "@/tests/unit/auth/dev-login-test-helpers"

describe("dev-login provisioning success", () => {
  const email = "preview.success@example.com"

  beforeEach(async () => {
    process.env.VERCEL_ENV = "preview"
    process.env.DEV_LOGIN_ENABLED = "true"
    process.env.DEV_LOGIN_SECRET = "shared-preview-secret"
    await prisma.account.deleteMany({
      where: {
        provider: "credentials",
        providerAccountId: email,
      },
    })
    await prisma.user.deleteMany({
      where: { email },
    })
  })

  afterEach(async () => {
    await prisma.account.deleteMany({
      where: {
        provider: "credentials",
        providerAccountId: email,
      },
    })
    await prisma.user.deleteMany({
      where: { email },
    })
  })

  it("creates a user on first successful credentials login", async () => {
    const user = await authorizeDevLogin(
      createDevLoginCredentials({
        email,
      }),
    )

    const persistedUser = await prisma.user.findUnique({
      where: { email },
      include: { accounts: true },
    })

    expect(user?.email).toBe(email)
    expect(persistedUser?.accounts.some((account) => account.provider === "credentials")).toBe(true)
  })

  it("reuses an existing user record on subsequent credentials login", async () => {
    const existing = await prisma.user.create({
      data: {
        id: "existing-dev-login-user",
        email,
        name: "Existing Preview User",
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    })

    const user = await authorizeDevLogin(
      createDevLoginCredentials({
        email,
      }),
    )

    expect(user?.id).toBe(existing.id)
  })
})
