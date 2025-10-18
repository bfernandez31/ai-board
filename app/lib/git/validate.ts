import { remark } from 'remark';

/**
 * Validation result for markdown content
 */
export interface MarkdownValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates markdown syntax using remark parser
 *
 * @param content - Markdown content to validate
 * @returns Validation result with success flag and optional error message
 *
 * @example
 * const result = await validateMarkdown('# Valid Markdown\n\nContent here');
 * if (!result.valid) {
 *   console.error('Invalid markdown:', result.error);
 * }
 */
export async function validateMarkdown(content: string): Promise<MarkdownValidationResult> {
  try {
    // Attempt to parse markdown with remark
    await remark().process(content);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid markdown syntax',
    };
  }
}
