import { defineConfig } from '@prisma/client';

export default defineConfig({
  seed: 'tsx prisma/seed.ts',
});
