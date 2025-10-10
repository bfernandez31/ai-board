/**
 * E2E Visual Regression Tests for JobStatusIndicator Component
 *
 * Test Suite: T023
 * Feature: 020-9179-real-time
 *
 * Tests visual appearance of job status indicators for all 5 states:
 * - PENDING: Gray clock icon
 * - RUNNING: Blue pen icon with animation
 * - COMPLETED: Green checkmark icon
 * - FAILED: Red X-circle icon
 * - CANCELLED: Gray ban icon
 *
 * Each test captures Playwright screenshots for visual regression testing.
 */

import { test, expect } from '@playwright/test'

test.describe('JobStatusIndicator - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a test page that renders JobStatusIndicator components
    // For now, we'll use the board page with test tickets
    await page.goto('/projects/1/board')
  })

  test('PENDING status shows gray clock icon', async ({ page }) => {
    // Find a ticket with PENDING job status
    // We'll need to create a test ticket with a PENDING job
    const pendingIndicator = page.locator('[role="img"][aria-label*="is pending"]').first()

    // Verify indicator is visible
    await expect(pendingIndicator).toBeVisible()

    // Verify it contains clock icon (lucide-react Clock component renders as svg)
    const iconSvg = pendingIndicator.locator('svg').first()
    await expect(iconSvg).toBeVisible()

    // Verify gray color styling
    await expect(iconSvg).toHaveClass(/text-gray-500/)

    // Verify status text
    await expect(pendingIndicator.locator('span')).toHaveText('PENDING')
    await expect(pendingIndicator.locator('span')).toHaveClass(/text-gray-500/)

    // Capture screenshot for visual regression
    await expect(pendingIndicator).toHaveScreenshot('pending-status-indicator.png')
  })

  test('RUNNING status shows blue pen icon with animation', async ({ page }) => {
    // Find a ticket with RUNNING job status
    const runningIndicator = page.locator('[role="img"][aria-label*="is running"]').first()

    // Verify indicator is visible
    await expect(runningIndicator).toBeVisible()

    // Verify it contains pen icon
    const iconSvg = runningIndicator.locator('svg').first()
    await expect(iconSvg).toBeVisible()

    // Verify blue color styling
    await expect(iconSvg).toHaveClass(/text-blue-500/)

    // Verify status text
    await expect(runningIndicator.locator('span')).toHaveText('RUNNING')
    await expect(runningIndicator.locator('span')).toHaveClass(/text-blue-500/)

    // Verify animation class is applied
    const animatedContainer = runningIndicator.locator('.animate-quill-writing')
    await expect(animatedContainer).toBeVisible()

    // Capture screenshot for visual regression (will show animation frame)
    await expect(runningIndicator).toHaveScreenshot('running-status-indicator.png')
  })

  test('COMPLETED status shows green checkmark icon', async ({ page }) => {
    // Find a ticket with COMPLETED job status
    const completedIndicator = page.locator('[role="img"][aria-label*="is completed"]').first()

    // Verify indicator is visible
    await expect(completedIndicator).toBeVisible()

    // Verify it contains checkmark icon
    const iconSvg = completedIndicator.locator('svg').first()
    await expect(iconSvg).toBeVisible()

    // Verify green color styling
    await expect(iconSvg).toHaveClass(/text-green-500/)

    // Verify status text
    await expect(completedIndicator.locator('span')).toHaveText('COMPLETED')
    await expect(completedIndicator.locator('span')).toHaveClass(/text-green-500/)

    // Verify NO animation class (should be static)
    const animatedContainer = completedIndicator.locator('.animate-quill-writing')
    await expect(animatedContainer).toHaveCount(0)

    // Capture screenshot for visual regression
    await expect(completedIndicator).toHaveScreenshot('completed-status-indicator.png')
  })

  test('FAILED status shows red X-circle icon', async ({ page }) => {
    // Find a ticket with FAILED job status
    const failedIndicator = page.locator('[role="img"][aria-label*="is failed"]').first()

    // Verify indicator is visible
    await expect(failedIndicator).toBeVisible()

    // Verify it contains X-circle icon
    const iconSvg = failedIndicator.locator('svg').first()
    await expect(iconSvg).toBeVisible()

    // Verify red color styling (distinct from CANCELLED gray)
    await expect(iconSvg).toHaveClass(/text-red-500/)

    // Verify status text
    await expect(failedIndicator.locator('span')).toHaveText('FAILED')
    await expect(failedIndicator.locator('span')).toHaveClass(/text-red-500/)

    // Verify NO animation class (should be static)
    const animatedContainer = failedIndicator.locator('.animate-quill-writing')
    await expect(animatedContainer).toHaveCount(0)

    // Capture screenshot for visual regression
    await expect(failedIndicator).toHaveScreenshot('failed-status-indicator.png')
  })

  test('CANCELLED status shows gray ban icon', async ({ page }) => {
    // Find a ticket with CANCELLED job status
    const cancelledIndicator = page.locator('[role="img"][aria-label*="is cancelled"]').first()

    // Verify indicator is visible
    await expect(cancelledIndicator).toBeVisible()

    // Verify it contains ban icon
    const iconSvg = cancelledIndicator.locator('svg').first()
    await expect(iconSvg).toBeVisible()

    // Verify gray color styling (distinct from FAILED red)
    await expect(iconSvg).toHaveClass(/text-gray-400/)

    // Verify status text
    await expect(cancelledIndicator.locator('span')).toHaveText('CANCELLED')
    await expect(cancelledIndicator.locator('span')).toHaveClass(/text-gray-400/)

    // Verify NO animation class (should be static)
    const animatedContainer = cancelledIndicator.locator('.animate-quill-writing')
    await expect(animatedContainer).toHaveCount(0)

    // Capture screenshot for visual regression
    await expect(cancelledIndicator).toHaveScreenshot('cancelled-status-indicator.png')
  })

  test('Visual distinction between FAILED (red) and CANCELLED (gray)', async ({ page }) => {
    // This test verifies that FAILED and CANCELLED are visually distinct
    // by comparing their color values directly

    const failedIndicator = page.locator('[role="img"][aria-label*="is failed"]').first()
    const cancelledIndicator = page.locator('[role="img"][aria-label*="is cancelled"]').first()

    // Wait for both to be visible
    await expect(failedIndicator).toBeVisible()
    await expect(cancelledIndicator).toBeVisible()

    // Get computed colors for icon elements
    const failedIcon = failedIndicator.locator('svg').first()
    const cancelledIcon = cancelledIndicator.locator('svg').first()

    // Verify FAILED uses red color
    await expect(failedIcon).toHaveClass(/text-red-500/)

    // Verify CANCELLED uses gray color
    await expect(cancelledIcon).toHaveClass(/text-gray-400/)

    // Capture side-by-side screenshot for visual comparison
    const container = page.locator('body')
    await expect(container).toHaveScreenshot('failed-vs-cancelled-comparison.png')
  })
})
