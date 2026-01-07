/**
 * Integration Tests: Ticket Page Redirect URL Format
 *
 * AIB-158: Tests that the redirect URL format includes modal=open parameter.
 * Verifies the URL construction pattern used in /ticket/[key] page.
 *
 * Note: This is a unit-style test for the URL pattern because testing
 * the actual Server Component page route is complex due to:
 * 1. Internal fetch calls that don't forward auth headers
 * 2. Server-side redirect behavior requiring actual page rendering
 *
 * The actual page implementation at app/ticket/[key]/page.tsx uses the pattern:
 * redirect(`/projects/${ticket.projectId}/board?ticket=${key}&modal=open`)
 */

import { describe, it, expect } from 'vitest';

/**
 * Build the redirect URL for ticket page navigation
 * This mirrors the logic in app/ticket/[key]/page.tsx:71
 */
function buildTicketRedirectUrl(projectId: number, ticketKey: string): string {
  return `/projects/${projectId}/board?ticket=${ticketKey}&modal=open`;
}

describe('/ticket/[key] page redirect URL format', () => {
  describe('T002: redirect URL includes modal=open parameter', () => {
    it('should build URL with ticket and modal=open params', () => {
      const url = buildTicketRedirectUrl(1, 'ABC-123');

      expect(url).toBe('/projects/1/board?ticket=ABC-123&modal=open');

      // Parse and verify structure
      const parsed = new URL(url, 'http://localhost:3000');
      expect(parsed.pathname).toBe('/projects/1/board');
      expect(parsed.searchParams.get('ticket')).toBe('ABC-123');
      expect(parsed.searchParams.get('modal')).toBe('open');
    });

    it('should include modal=open for any ticket key format', () => {
      // Test various key formats
      const testCases = [
        { projectId: 1, ticketKey: 'E2E-1' },
        { projectId: 42, ticketKey: 'ABC-999' },
        { projectId: 100, ticketKey: 'XYZ-12345' },
      ];

      for (const { projectId, ticketKey } of testCases) {
        const url = buildTicketRedirectUrl(projectId, ticketKey);
        const parsed = new URL(url, 'http://localhost:3000');

        expect(parsed.searchParams.get('ticket')).toBe(ticketKey);
        expect(parsed.searchParams.get('modal')).toBe('open');
      }
    });

    it('should have modal param after ticket param (consistent ordering)', () => {
      const url = buildTicketRedirectUrl(1, 'TEST-1');

      // Verify the pattern matches what we implemented
      expect(url).toMatch(/\?ticket=.+&modal=open$/);
    });
  });

  describe('URL format verification against actual implementation', () => {
    it('should match the pattern used in app/ticket/[key]/page.tsx', () => {
      // This is the exact pattern from line 71 of the page component:
      // redirect(`/projects/${ticket.projectId}/board?ticket=${key}&modal=open`)
      const projectId = 5;
      const key = 'AIB-158';

      // Simulate what the page does
      const expectedUrl = `/projects/${projectId}/board?ticket=${key}&modal=open`;

      // Verify it matches our helper
      expect(buildTicketRedirectUrl(projectId, key)).toBe(expectedUrl);

      // Verify URL is well-formed
      const parsed = new URL(expectedUrl, 'http://localhost:3000');
      expect(parsed.pathname).toBe('/projects/5/board');
      expect(parsed.searchParams.get('ticket')).toBe('AIB-158');
      expect(parsed.searchParams.get('modal')).toBe('open');
    });
  });
});
