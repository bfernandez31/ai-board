/**
 * E2E Animation Tests for JobStatusIndicator Component
 *
 * Test Suite: T024
 * Feature: 020-9179-real-time
 *
 * Tests animation behavior for RUNNING status:
 * - Animation plays continuously (2s loop)
 * - Animation uses GPU-accelerated transform properties
 * - Animation respects prefers-reduced-motion media query
 * - No animation for other statuses (PENDING/COMPLETED/FAILED/CANCELLED)
 */

import { test, expect } from '@playwright/test'

test.describe('JobStatusIndicator - Animations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to board page
    await page.goto('/projects/1/board')
  })

  test('RUNNING animation plays continuously with 2s loop', async ({ page }) => {
    // Find RUNNING status indicator
    const runningIndicator = page.locator('[role="img"][aria-label*="is running"]').first()
    await expect(runningIndicator).toBeVisible()

    // Verify animation class is applied
    const animatedElement = runningIndicator.locator('.animate-quill-writing')
    await expect(animatedElement).toBeVisible()

    // Verify animation CSS property exists
    const animationValue = await animatedElement.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return styles.animation
    })

    // Verify animation duration is 2s and infinite
    expect(animationValue).toContain('2s')
    expect(animationValue).toContain('infinite')
    expect(animationValue).toContain('quill-writing')
  })

  test('Animation uses GPU-accelerated transform properties', async ({ page }) => {
    // Find RUNNING status indicator
    const runningIndicator = page.locator('[role="img"][aria-label*="is running"]').first()
    await expect(runningIndicator).toBeVisible()

    const animatedElement = runningIndicator.locator('.animate-quill-writing')

    // Verify will-change property is set for GPU acceleration
    const willChange = await animatedElement.evaluate((el) => {
      return (el as HTMLElement).style.willChange
    })
    expect(willChange).toBe('transform')

    // Verify animation uses transform property (GPU-accelerated)
    const animationName = await animatedElement.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return styles.animationName
    })
    expect(animationName).toBe('quill-writing')

    // Verify transform is applied during animation
    // Note: We can't easily check the exact transform value since it changes
    // But we can verify the animation is active
    const animationDuration = await animatedElement.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return styles.animationDuration
    })
    expect(animationDuration).toBe('2s')
  })

  test('Animation respects prefers-reduced-motion media query', async ({ page, context }) => {
    // Close current page and create new context with prefers-reduced-motion
    await page.close()

    const newContext = await context.browser()?.newContext({
      reducedMotion: 'reduce',
    })

    if (!newContext) {
      throw new Error('Failed to create new context')
    }

    const newPage = await newContext.newPage()
    await newPage.goto('/projects/1/board')

    // Find RUNNING status indicator
    const runningIndicator = newPage.locator('[role="img"][aria-label*="is running"]').first()
    await expect(runningIndicator).toBeVisible()

    // Verify animation class is still applied (component logic unchanged)
    const animatedElement = runningIndicator.locator('.animate-quill-writing')
    await expect(animatedElement).toBeVisible()

    // Verify animation is disabled via CSS
    const animationValue = await animatedElement.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return styles.animation
    })

    // With prefers-reduced-motion: reduce, animation should be "none"
    expect(animationValue).toContain('none')

    await newContext.close()
  })

  test('No animation for PENDING status', async ({ page }) => {
    // Find PENDING status indicator
    const pendingIndicator = page.locator('[role="img"][aria-label*="is pending"]').first()
    await expect(pendingIndicator).toBeVisible()

    // Verify NO animation class
    const animatedElement = pendingIndicator.locator('.animate-quill-writing')
    await expect(animatedElement).toHaveCount(0)

    // Verify icon is static (no animation property)
    const iconContainer = pendingIndicator.locator('div').first()
    const animationValue = await iconContainer.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return styles.animation
    })

    // Should have no animation or animation-name: none
    expect(animationValue).not.toContain('quill-writing')
  })

  test('No animation for COMPLETED status', async ({ page }) => {
    // Find COMPLETED status indicator
    const completedIndicator = page.locator('[role="img"][aria-label*="is completed"]').first()
    await expect(completedIndicator).toBeVisible()

    // Verify NO animation class
    const animatedElement = completedIndicator.locator('.animate-quill-writing')
    await expect(animatedElement).toHaveCount(0)

    // Verify icon is static
    const iconContainer = completedIndicator.locator('div').first()
    const animationValue = await iconContainer.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return styles.animation
    })

    expect(animationValue).not.toContain('quill-writing')
  })

  test('No animation for FAILED status', async ({ page }) => {
    // Find FAILED status indicator
    const failedIndicator = page.locator('[role="img"][aria-label*="is failed"]').first()
    await expect(failedIndicator).toBeVisible()

    // Verify NO animation class
    const animatedElement = failedIndicator.locator('.animate-quill-writing')
    await expect(animatedElement).toHaveCount(0)

    // Verify icon is static
    const iconContainer = failedIndicator.locator('div').first()
    const animationValue = await iconContainer.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return styles.animation
    })

    expect(animationValue).not.toContain('quill-writing')
  })

  test('No animation for CANCELLED status', async ({ page }) => {
    // Find CANCELLED status indicator
    const cancelledIndicator = page.locator('[role="img"][aria-label*="is cancelled"]').first()
    await expect(cancelledIndicator).toBeVisible()

    // Verify NO animation class
    const animatedElement = cancelledIndicator.locator('.animate-quill-writing')
    await expect(animatedElement).toHaveCount(0)

    // Verify icon is static
    const iconContainer = cancelledIndicator.locator('div').first()
    const animationValue = await iconContainer.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return styles.animation
    })

    expect(animationValue).not.toContain('quill-writing')
  })

  test('Animation continues indefinitely for long-running jobs', async ({ page }) => {
    // Find RUNNING status indicator
    const runningIndicator = page.locator('[role="img"][aria-label*="is running"]').first()
    await expect(runningIndicator).toBeVisible()

    const animatedElement = runningIndicator.locator('.animate-quill-writing')

    // Verify animation is running initially
    let animationValue = await animatedElement.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return styles.animation
    })
    expect(animationValue).toContain('quill-writing')
    expect(animationValue).toContain('infinite')

    // Wait for 5 seconds (more than 2 animation cycles)
    await page.waitForTimeout(5000)

    // Verify animation is still running
    animationValue = await animatedElement.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return styles.animation
    })
    expect(animationValue).toContain('quill-writing')
    expect(animationValue).toContain('infinite')
  })
})
