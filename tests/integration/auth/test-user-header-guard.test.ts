import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getTestContext, type TestContext } from "@/tests/fixtures/vitest/setup"
import { getPrismaClient } from "@/tests/helpers/db-cleanup"

describe("x-test-user-id auth guard", () => {
  let ctx: TestContext
  const prisma = getPrismaClient()

  beforeEach(async () => {
    ctx = await getTestContext()
    await ctx.cleanup()
    // Clean up tokens created by previous tests
    await prisma.personalAccessToken.deleteMany({
      where: { userId: "test-user-id" },
    })
    vi.restoreAllMocks()
  })

  afterEach(async () => {
    await prisma.personalAccessToken.deleteMany({
      where: { userId: "test-user-id" },
    })
    vi.unstubAllEnvs()
  })

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
})
