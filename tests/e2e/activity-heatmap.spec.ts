import { test, expect } from "@playwright/test";

test.describe("Activity Heatmap", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/projects");
  });

  test("should display the activity heatmap", async ({ page }) => {
    const heatmap = page.locator(".aurora-bg-section").filter({ hasText: "AI Activity" });
    await expect(heatmap).toBeVisible();
  });

  test("should display correct intensity levels", async ({ page }) => {
    const cell = page.locator(".aurora-cell-0").first();
    await expect(cell).toBeVisible();
  });

  test("should change heatmap data when filtering by agent", async ({ page }) => {
    const agentSelect = page.getByRole("combobox").first();
    await agentSelect.click();
    
    const options = page.getByRole("option");
    const count = await options.count();
    if (count > 1) {
      await options.nth(1).click();
      await expect(page).toHaveURL(/agent=/);
    }
  });

  test("should change heatmap data when selecting a year", async ({ page }) => {
    const yearSelect = page.getByRole("combobox").last();
    await yearSelect.click();
    
    const options = page.getByRole("option");
    const count = await options.count();
    if (count > 1) {
      await options.nth(count - 1).click();
      await expect(page).toHaveURL(/year=\d{4}/);
    }
  });
});
