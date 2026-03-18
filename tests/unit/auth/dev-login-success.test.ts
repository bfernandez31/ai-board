import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  authorizeDevLogin,
  parseDevLoginCredentials,
} from "@/app/lib/auth/dev-login"
import { createDevLoginCredentials, enabledDevLoginEnv } from "@/tests/unit/auth/dev-login-test-helpers"
import { prisma } from "@/lib/db/client"

interface MockDevLoginTx {
  user: {
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  account: {
    upsert: ReturnType<typeof vi.fn>
  }
}

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}))

describe("dev-login success", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.VERCEL_ENV = enabledDevLoginEnv.VERCEL_ENV
    process.env.DEV_LOGIN_ENABLED = enabledDevLoginEnv.DEV_LOGIN_ENABLED
    process.env.DEV_LOGIN_SECRET = enabledDevLoginEnv.DEV_LOGIN_SECRET
  })

  it("parses valid credentials and normalizes email casing", () => {
    const parsed = parseDevLoginCredentials(createDevLoginCredentials())

    expect(parsed.email).toBe("preview.user@example.com")
    expect(parsed.secret).toBe("shared-preview-secret")
    expect(parsed.redirectTo).toBe("/projects")
  })

  it("creates a first-time user and credentials account", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: MockDevLoginTx) => Promise<unknown>) => {
      const createdUser = {
        id: "created-user-id",
        email: "preview.user@example.com",
        name: "preview.user",
      }

      return callback({
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(createdUser),
          update: vi.fn(),
        },
        account: {
          upsert: vi.fn().mockResolvedValue({ id: "credentials-account-id" }),
        },
      })
    })

    const user = await authorizeDevLogin(createDevLoginCredentials())

    expect(user).toEqual({
      id: "created-user-id",
      email: "preview.user@example.com",
      name: "preview.user",
    })
  })

  it("reuses an existing user matched by normalized email", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: MockDevLoginTx) => Promise<unknown>) => {
      const existingUser = {
        id: "existing-user-id",
        email: "preview.user@example.com",
        name: "Existing User",
        emailVerified: new Date(),
      }

      return callback({
        user: {
          findUnique: vi.fn().mockResolvedValue(existingUser),
          create: vi.fn(),
          update: vi.fn().mockResolvedValue(existingUser),
        },
        account: {
          upsert: vi.fn().mockResolvedValue({ id: "credentials-account-id" }),
        },
      })
    })

    const user = await authorizeDevLogin(createDevLoginCredentials())

    expect(user?.id).toBe("existing-user-id")
    expect(user?.email).toBe("preview.user@example.com")
    expect(user?.name).toBe("Existing User")
  })
})
