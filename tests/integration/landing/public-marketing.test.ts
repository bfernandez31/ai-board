import { describe, expect, it } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('GET /', () => {
  it('renders pricing content between workflow and final CTA content', async () => {
    const response = await fetch(`${BASE_URL}/`);
    expect(response.status).toBe(200);

    const html = await response.text();
    const workflowIndex = html.indexOf('Streamlined Development Workflow');
    const pricingIndex = html.indexOf('Choose the rollout that fits your team');
    const ctaIndex = html.indexOf('Ready to Transform Your Workflow?');

    expect(workflowIndex).toBeGreaterThanOrEqual(0);
    expect(pricingIndex).toBeGreaterThan(workflowIndex);
    expect(ctaIndex).toBeGreaterThan(pricingIndex);
  });

  it('renders the three plans, CTA labels, and FAQ topics', async () => {
    const response = await fetch(`${BASE_URL}/`);
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('Free');
    expect(html).toContain('Pro');
    expect(html).toContain('Team');
    expect(html).toContain('Get Started');
    expect(html).toContain('Start 14-day trial');
    expect(html).toContain('BYOK');
    expect(html).toContain('supported');
  });
});
