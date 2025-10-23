import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Pure functions don't need jsdom
    include: ['tests/unit/**/*.test.ts'], // Only run Vitest unit tests
    exclude: ['tests/integration/**', 'tests/e2e/**', 'tests/**/*.spec.ts'], // Exclude Playwright tests
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
