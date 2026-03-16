/**
 * Integration Tests: Landing Page Pricing Section
 *
 * Tests that the landing page renders the pricing section with all plan cards,
 * FAQ content, and navigation link. Validates server-rendered HTML output.
 */
import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('Landing Page - Pricing Section', () => {
  describe('GET / (pricing content)', () => {
    it('should return 200 and contain the pricing section', async () => {
      const response = await fetch(BASE_URL);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain('id="pricing"');
      expect(html).toContain('Start free, then unlock more throughput and collaboration.');
    });

    it('should render all three plan names', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();

      expect(html).toContain('Free');
      expect(html).toContain('Pro');
      expect(html).toContain('Team');
    });

    it('should render plan prices', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();

      expect(html).toContain('$0');
      expect(html).toContain('$15');
      expect(html).toContain('$30');
    });

    it('should render CTA buttons linking to sign-in', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();

      expect(html).toContain('Get Started Free');
      expect(html).toContain('Start 14-day trial');
      expect(html).toContain('/auth/signin');
    });

    it('should render the "Most Popular" badge', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();

      expect(html).toContain('Most Popular');
    });

    it('should render plan features', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();

      // Free plan features
      expect(html).toContain('1 project');
      expect(html).toContain('5 tickets per month');
      expect(html).toContain('BYOK API key required');

      // Pro plan features
      expect(html).toContain('Unlimited projects');
      expect(html).toContain('Unlimited tickets');

      // Team plan features
      expect(html).toContain('Everything in Pro');
      expect(html).toContain('Project members');
      expect(html).toContain('Advanced analytics');
    });

    it('should render the FAQ section with all questions', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();

      expect(html).toContain('Pricing questions teams ask before they switch');
      expect(html).toContain('How should I think about the Free plan?');
      expect(html).toContain('What changes when I move to Pro?');
      expect(html).toContain('When does Team make sense?');
      expect(html).toContain('Do I need to relearn the workflow when upgrading?');
    });

    it('should contain navigation link to pricing section', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();

      expect(html).toContain('href="#pricing"');
      expect(html).toContain('Pricing');
    });
  });
});
