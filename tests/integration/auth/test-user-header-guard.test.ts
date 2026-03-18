import crypto from "crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createToken } from "@/lib/db/tokens"
import { getTestUserOverrideResolution } from "@/lib/db/users"
import { generatePersonalAccessToken } from "@/lib/tokens/generate"
import { getTestContext, type TestContext } from "@/tests/fixtures/vitest/setup"
import { getPrismaClient } from "@/tests/helpers/db-cleanup"

describe("x-test-user-id auth guard", () => {
  let ctx: TestContext
  const prisma = getPrismaClient()

  beforeEach(async () => {
    ctx = await getTestContext()
    await ctx.cleanup()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  async function createSessionCookie(userId: string): Promise<string> {
    const sessionToken = `session-${crypto.randomUUID()}`

    await prisma.session.create({
      data: {
        id: `session-${crypto.randomUUID()}`,
        sessionToken,
        userId,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    return [
      `authjs.session-token=${sessionToken}`,
      `next-auth.session-token=${sessionToken}`,
    ].join("; ")
  }

  it("rejects header-only requests when explicit override is not enabled", async () => {
    const response = await ctx.api.get("/api/tokens", {
      enableTestAuthOverride: false,
    })

    expect(response.status).toBe(401)
    expect(response.data).toMatchObject({
      error: "Unauthorized",
      code: "AUTH_REQUIRED",
    })
  })

  it("preserves session identity when a conflicting header is present without explicit override", async () => {
    const otherUser = await ctx.createUser("other-session@e2e.local")
    const sessionCookie = await createSessionCookie("test-user-id")

    const seededToken = generatePersonalAccessToken()
    await createToken(
      "test-user-id",
      "[e2e] Session Identity Token",
      seededToken.hash,
      seededToken.salt,
      seededToken.preview
    )

    const otherUserToken = generatePersonalAccessToken()
    await createToken(
      otherUser.id,
      "[e2e] Other User Token",
      otherUserToken.hash,
      otherUserToken.salt,
      otherUserToken.preview
    )

    const response = await ctx.api.get<{
      tokens: Array<{ name: string }>
    }>("/api/tokens", {
      testUserId: otherUser.id,
      enableTestAuthOverride: false,
      headers: {
        Cookie: sessionCookie,
      },
    })

    expect(response.status).toBe(200)
    expect(response.data.tokens).toHaveLength(1)
    expect(response.data.tokens[0]?.name).toBe("[e2e] Session Identity Token")
  })

  it("allows explicit test override requests for the seeded test user", async () => {
    const response = await ctx.api.get<{ tokens: unknown[] }>("/api/tokens", {
      enableTestAuthOverride: true,
    })

    expect(response.status).toBe(200)
    expect(response.data.tokens).toEqual([])
  })

  it("fails safely for unknown override users even when explicit test override is enabled", async () => {
    const response = await ctx.api.get("/api/tokens", {
      testUserId: "missing-test-user-id",
      enableTestAuthOverride: true,
    })

    expect(response.status).toBe(401)
    expect(response.data).toMatchObject({ error: "Unauthorized" })
  })

  it("emits blocked-attempt metadata when an override is not explicitly allowed", async () => {
    vi.stubEnv("TEST_MODE", "true")
    vi.stubEnv("NODE_ENV", "test")

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const resolution = await getTestUserOverrideResolution(
      new Request("http://localhost:3000/api/tokens", {
        headers: {
          "x-test-user-id": "victim-user-id",
        },
      })
    )

    expect(resolution).toEqual({
      requestedUserId: "victim-user-id",
      allowed: false,
      rejectionReason: "missing-explicit-override",
    })
    expect(warnSpy).toHaveBeenCalledWith(
      "[auth] blocked x-test-user-id override",
      expect.objectContaining({
        route: "/api/tokens",
        reason: "missing-explicit-override",
        requestedUserId: "victim-user-id",
      })
    )
  })
})
