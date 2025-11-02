import { test, expect } from '../helpers/worker-isolation';

test.describe('Debug Authentication', () => {
  test('verify session cookie is set', async ({ page , projectId }) => {
    // Get all cookies
    const cookies = await page.context().cookies();
    console.log('Page cookies:', JSON.stringify(cookies, null, 2));

    // Navigate to a protected page
    await page.goto('http://localhost:3000/projects');

    // Check if redirected to login
    const url = page.url();
    console.log('Current URL after navigation:', url);

    expect(url).toContain('/projects');
  });

  test('verify API request has cookie', async ({ request , projectId }) => {
    // Try to call API (using project-scoped tickets endpoint)
    const response = await request.get(`http://localhost:3000/api/projects/${projectId}/tickets`);

    console.log('API response status:', response.status());
    console.log('API response headers:', response.headers());

    const body = await response.text();
    console.log('API response body (first 500 chars):', body.substring(0, 500));

    expect(response.status()).toBe(200);
  });

  test('verify POST ticket API with cookie', async ({ request , projectId }) => {
    // Use the request fixture which has x-test-user-id header configured
    const response = await request.post(`http://localhost:3000/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Debug Test Ticket',
        description: 'Testing authentication',
      },
    });

    console.log('POST response status:', response.status());
    console.log('POST response headers:', response.headers());

    const body = await response.text();
    console.log('POST response body (first 500 chars):', body.substring(0, 500));

    expect(response.status()).toBe(201);
  });
});
