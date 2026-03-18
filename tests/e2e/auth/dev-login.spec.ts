import { test, expect } from "@/tests/helpers/worker-isolation"

test.describe("preview dev-login", () => {
  test("redirects a successful credentials sign-in to projects", async ({ page }) => {
    await page.goto("/auth/signin")

    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/shared secret/i)).toBeVisible()

    await page.getByLabel(/email/i).fill("preview.browser@example.com")
    await page.getByLabel(/shared secret/i).fill("shared-preview-secret")
    await page.getByRole("button", { name: /continue with preview login/i }).click()

    await page.waitForURL("**/projects")
    await expect(page).toHaveURL(/\/projects$/)
  })
})
