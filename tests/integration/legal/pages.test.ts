/**
 * Integration Tests: Legal Pages
 *
 * Tests for /legal/terms and /legal/privacy page routes.
 * Verifies pages return 200 and contain all required content sections.
 */
import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const SHARED_FOOTER_EXPECTATIONS = ['Terms of Service', 'Privacy Policy', 'https://github.com/bfernandez31/ai-board'];

describe('Legal Pages', () => {
  describe('GET /legal/terms', () => {
    it('should return 200 with Terms of Service content', async () => {
      const response = await fetch(`${BASE_URL}/legal/terms`);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain('Terms of Service');
      expect(html).toContain('Effective Date');
    });

    it('should contain all required FR-003 sections', async () => {
      const response = await fetch(`${BASE_URL}/legal/terms`);
      const html = await response.text();

      expect(html).toContain('Conditions of Use');
      expect(html).toContain('Limitation of Liability');
      expect(html).toContain('BYOK API Cost Responsibility');
      expect(html).toContain('AI-Generated Code Responsibility');
    });

    it('should render the shared public footer links', async () => {
      const response = await fetch(`${BASE_URL}/legal/terms`);
      const html = await response.text();

      for (const expected of SHARED_FOOTER_EXPECTATIONS) {
        expect(html).toContain(expected);
      }
    });
  });

  describe('GET /legal/privacy', () => {
    it('should return 200 with Privacy Policy content', async () => {
      const response = await fetch(`${BASE_URL}/legal/privacy`);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain('Privacy Policy');
      expect(html).toContain('Effective Date');
    });

    it('should contain all required FR-004 sections', async () => {
      const response = await fetch(`${BASE_URL}/legal/privacy`);
      const html = await response.text();

      expect(html).toContain('Data Collected');
      expect(html).toContain('Cookies Used');
      expect(html).toContain('No Data Resale');
      expect(html).toContain('GDPR Rights');
    });

    it('should render the shared public footer links', async () => {
      const response = await fetch(`${BASE_URL}/legal/privacy`);
      const html = await response.text();

      for (const expected of SHARED_FOOTER_EXPECTATIONS) {
        expect(html).toContain(expected);
      }
    });
  });
});
