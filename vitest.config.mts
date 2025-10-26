import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    // Use happy-dom for React hook tests (faster than jsdom)
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'], // Only run Vitest unit tests
    exclude: ['tests/integration/**', 'tests/e2e/**', 'tests/**/*.spec.ts'], // Exclude Playwright tests
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
