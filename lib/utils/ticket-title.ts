/**
 * Utility functions for ticket title operations
 */

const PREFIX = 'Copy of ';
const MAX_LENGTH = 100;

/**
 * Creates a duplicate ticket title with "Copy of " prefix.
 * Truncates the original title if necessary to ensure total length <= 100 chars.
 *
 * @param originalTitle - The original ticket title
 * @returns The new title with "Copy of " prefix, max 100 characters
 */
export function createDuplicateTitle(originalTitle: string): string {
  const maxOriginalLength = MAX_LENGTH - PREFIX.length;
  const truncatedTitle =
    originalTitle.length > maxOriginalLength
      ? originalTitle.slice(0, maxOriginalLength)
      : originalTitle;
  return `${PREFIX}${truncatedTitle}`;
}
