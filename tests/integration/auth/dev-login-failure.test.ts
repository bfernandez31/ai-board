import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db/client"
import { authorizeDevLogin } from "@/app/lib/auth/dev-login"
import { createDevLoginCredentials } from "@/tests/unit/auth/dev-login-test-helpers"

describe("dev-login provisioning failure", () => {
  const email = "preview.failure@example.com"

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

  it("does not create user or account records for invalid email attempts", async () => {
    const user = await authorizeDevLogin(
      createDevLoginCredentials({
        email: "not-an-email",
      }),
    )

    const persistedUser = await prisma.user.findUnique({
      where: { email },
    })

    expect(user).toBeNull()
    expect(persistedUser).toBeNull()
  })

  it("does not create user or account records for wrong-secret attempts", async () => {
    const user = await authorizeDevLogin(
      createDevLoginCredentials({
        email,
        secret: "wrong-secret",
      }),
    )

    const persistedUser = await prisma.user.findUnique({
      where: { email },
      include: { accounts: true },
    })

    expect(user).toBeNull()
    expect(persistedUser).toBeNull()
  })
})
