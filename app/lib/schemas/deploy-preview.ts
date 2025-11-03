import { z } from 'zod';

/**
 * Zod validation schema for Vercel preview deployment URLs
 *
 * Requirements:
 * - HTTPS-only protocol
 * - Valid Vercel preview domain pattern (*.vercel.app)
 * - Maximum 500 characters
 */
export const previewUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .regex(
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
    'Must be a valid Vercel preview URL (https://*.vercel.app)'
  )
  .max(500, 'Preview URL must be ≤500 characters');

/**
 * TypeScript type inferred from the schema
 */
export type PreviewUrl = z.infer<typeof previewUrlSchema>;
