import { test, expect } from "../../helpers/worker-isolation"
import {
  TEST_AUTH_OVERRIDE_HEADER,
  TEST_USER_HEADER,
} from "../../../lib/auth/test-user-override"

test.describe("x-test-user-id proxy guard", () => {
  test("redirects protected page requests when x-test-user-id is sent without explicit override", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: {
        [TEST_USER_HEADER]: "test-user-id",
      },
    })
    const page = await context.newPage()

    await page.goto("/projects")

    await expect(page).toHaveURL(/\/auth\/signin/)
    await context.close()
  })

  test("returns 401 for protected API requests when x-test-user-id is sent without explicit override", async ({
    playwright,
  }) => {
    const request = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: {
        [TEST_USER_HEADER]: "test-user-id",
      },
    })

    const response = await request.get("/api/tokens")

    expect(response.status()).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: "Unauthorized",
      code: "AUTH_REQUIRED",
    })

    await request.dispose()
  })

  test("continues to allow explicit test override requests in the browser harness", async ({
    page,
  }) => {
    await page.context().setExtraHTTPHeaders({
      [TEST_USER_HEADER]: "test-user-id",
      [TEST_AUTH_OVERRIDE_HEADER]: "true",
    })

    await page.goto("/projects")

    await expect(page).toHaveURL(/\/projects$/)
  })
})
