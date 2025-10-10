/**
 * E2E Test for Ticket Card Metadata Removal
 *
 * Test Suite: T026
 * Feature: 020-9179-real-time
 *
 * Verifies that ticket cards NO LONGER contain legacy metadata section:
 * - No "PLAN:" text
 * - No "BUILD:" text
 * - No "VERIFY:" text
 * - No "messages / tools" text
 *
 * The old metadata section has been replaced with JobStatusIndicator.
 */

import { test, expect } from '@playwright/test'

test.describe('TicketCard - Metadata Removal', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to board page
    await page.goto('/projects/1/board')
  })

  test('Ticket card does NOT contain "PLAN:" text', async ({ page }) => {
    // Wait for board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 })

    // Get all ticket cards
    const ticketCards = page.locator('[data-testid="ticket-card"]')
    const count = await ticketCards.count()
    expect(count).toBeGreaterThan(0)

    // Check each ticket card for absence of "PLAN:" text
    for (let i = 0; i < count; i++) {
      const card = ticketCards.nth(i)
      const cardText = await card.textContent()

      // Verify "PLAN:" text is NOT present
      expect(cardText).not.toContain('PLAN:')
    }
  })

  test('Ticket card does NOT contain "BUILD:" text', async ({ page }) => {
    // Wait for board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 })

    // Get all ticket cards
    const ticketCards = page.locator('[data-testid="ticket-card"]')
    const count = await ticketCards.count()
    expect(count).toBeGreaterThan(0)

    // Check each ticket card for absence of "BUILD:" text
    for (let i = 0; i < count; i++) {
      const card = ticketCards.nth(i)
      const cardText = await card.textContent()

      // Verify "BUILD:" text is NOT present
      expect(cardText).not.toContain('BUILD:')
    }
  })

  test('Ticket card does NOT contain "VERIFY:" text', async ({ page }) => {
    // Wait for board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 })

    // Get all ticket cards
    const ticketCards = page.locator('[data-testid="ticket-card"]')
    const count = await ticketCards.count()
    expect(count).toBeGreaterThan(0)

    // Check each ticket card for absence of "VERIFY:" text
    for (let i = 0; i < count; i++) {
      const card = ticketCards.nth(i)
      const cardText = await card.textContent()

      // Verify "VERIFY:" text is NOT present
      expect(cardText).not.toContain('VERIFY:')
    }
  })

  test('Ticket card does NOT contain "messages / tools" text', async ({ page }) => {
    // Wait for board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 })

    // Get all ticket cards
    const ticketCards = page.locator('[data-testid="ticket-card"]')
    const count = await ticketCards.count()
    expect(count).toBeGreaterThan(0)

    // Check each ticket card for absence of "messages / tools" text
    for (let i = 0; i < count; i++) {
      const card = ticketCards.nth(i)
      const cardText = await card.textContent()

      // Verify "messages" and "tools" text patterns are NOT present
      expect(cardText).not.toMatch(/\d+\s*messages/)
      expect(cardText).not.toMatch(/\d+\s*tools/)
      expect(cardText).not.toContain('messages / tools')
    }
  })

  test('Ticket card has clean design with only essential elements', async ({ page }) => {
    // Wait for board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 })

    // Get first ticket card
    const ticketCard = page.locator('[data-testid="ticket-card"]').first()
    await expect(ticketCard).toBeVisible()

    // Verify essential elements are present
    // 1. Ticket ID (e.g., "#123")
    const ticketId = ticketCard.locator('span.text-xs.text-zinc-400.font-mono')
    await expect(ticketId).toBeVisible()
    const idText = await ticketId.textContent()
    expect(idText).toMatch(/#\d+/)

    // 2. Badge (e.g., "SONNET")
    const badge = ticketCard.locator('text=SONNET')
    await expect(badge).toBeVisible()

    // 3. Title
    const title = ticketCard.locator('h3')
    await expect(title).toBeVisible()

    // 4. Verify NO metadata footer sections exist
    const cardText = await ticketCard.textContent()
    expect(cardText).not.toContain('PLAN:')
    expect(cardText).not.toContain('BUILD:')
    expect(cardText).not.toContain('VERIFY:')
  })

  test('Ticket card with job shows JobStatusIndicator instead of metadata', async ({ page }) => {
    // Wait for board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 })

    // Find a ticket card with a job status indicator
    const cardWithJob = page.locator('[data-testid="ticket-card"]')
      .filter({ has: page.locator('[role="img"]') })
      .first()

    // If no cards with jobs exist, skip this test
    if (await cardWithJob.count() === 0) {
      test.skip()
      return
    }

    await expect(cardWithJob).toBeVisible()

    // Verify JobStatusIndicator is present
    const jobIndicator = cardWithJob.locator('[role="img"]')
    await expect(jobIndicator).toBeVisible()

    // Verify metadata section is NOT present
    const cardText = await cardWithJob.textContent()
    expect(cardText).not.toContain('PLAN:')
    expect(cardText).not.toContain('BUILD:')
    expect(cardText).not.toContain('VERIFY:')
    expect(cardText).not.toContain('messages')
    expect(cardText).not.toContain('tools')

    // Verify card structure: ID, Badge, Title, and JobStatusIndicator only
    const hasId = await cardWithJob.locator('span.font-mono').count() > 0
    const hasBadge = await cardWithJob.locator('text=SONNET').count() > 0
    const hasTitle = await cardWithJob.locator('h3').count() > 0
    const hasJobIndicator = await cardWithJob.locator('[role="img"]').count() > 0

    expect(hasId).toBe(true)
    expect(hasBadge).toBe(true)
    expect(hasTitle).toBe(true)
    expect(hasJobIndicator).toBe(true)
  })

  test('Ticket card without job shows clean card (no status indicator, no metadata)', async ({ page }) => {
    // Wait for board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 })

    // Find a ticket card WITHOUT a job status indicator
    const allCards = page.locator('[data-testid="ticket-card"]')
    const count = await allCards.count()

    let foundCardWithoutJob = false

    for (let i = 0; i < count; i++) {
      const card = allCards.nth(i)
      const hasJobIndicator = await card.locator('[role="img"]').count() > 0

      if (!hasJobIndicator) {
        foundCardWithoutJob = true

        // Verify card has essential elements only
        const hasId = await card.locator('span.font-mono').count() > 0
        const hasBadge = await card.locator('text=SONNET').count() > 0
        const hasTitle = await card.locator('h3').count() > 0

        expect(hasId).toBe(true)
        expect(hasBadge).toBe(true)
        expect(hasTitle).toBe(true)

        // Verify NO metadata or job indicator
        const cardText = await card.textContent()
        expect(cardText).not.toContain('PLAN:')
        expect(cardText).not.toContain('BUILD:')
        expect(cardText).not.toContain('VERIFY:')
        expect(cardText).not.toContain('messages')
        expect(cardText).not.toContain('tools')

        break
      }
    }

    // If all cards have jobs, that's okay (test passes)
    // The important thing is IF a card has no job, it should be clean
    if (!foundCardWithoutJob) {
      console.log('Note: All cards have jobs. Clean card test passed vacuously.')
    }
  })

  test('Visual snapshot: clean ticket card design', async ({ page }) => {
    // Wait for board to load
    await page.waitForSelector('[data-testid="ticket-card"]', { timeout: 10000 })

    // Get first ticket card
    const ticketCard = page.locator('[data-testid="ticket-card"]').first()
    await expect(ticketCard).toBeVisible()

    // Capture screenshot for visual regression
    await expect(ticketCard).toHaveScreenshot('clean-ticket-card.png')
  })
})
