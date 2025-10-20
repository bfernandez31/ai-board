/**
 * Markdown parsing utilities
 *
 * Provides functions to extract image URLs from markdown content
 */

/**
 * Extracted image URL information
 */
export interface ExtractedImageUrl {
  /** Alt text from markdown (description) */
  alt: string;
  /** Image URL (must be absolute HTTPS) */
  url: string;
}

/**
 * Extract image URLs from markdown content
 *
 * Parses markdown image syntax: ![alt text](url)
 * Only extracts absolute HTTPS URLs (external images).
 * Relative URLs and non-HTTPS URLs are ignored.
 *
 * @param markdown - Markdown content to parse
 * @returns Array of extracted image URLs with alt text
 *
 * @example
 * const images = extractImageUrls('![Mockup](https://example.com/image.png)');
 * // Returns: [{ alt: 'Mockup', url: 'https://example.com/image.png' }]
 */
export function extractImageUrls(markdown: string): ExtractedImageUrl[] {
  const images: ExtractedImageUrl[] = [];

  // Regex pattern: ![alt text](url)
  // Captures:
  // - Group 1: alt text (anything except ] )
  // - Group 2: URL (anything except ) )
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  let match;
  while ((match = imageRegex.exec(markdown)) !== null) {
    const alt = match[1]?.trim() || '';
    const url = match[2]?.trim() || '';

    // Validate URL is absolute HTTPS
    if (isValidExternalImageUrl(url)) {
      images.push({ alt: alt || 'Image', url });
    }
  }

  return images;
}

/**
 * Validate if a URL is a valid external image URL
 *
 * Requirements:
 * - Must be absolute URL (starts with https://)
 * - Must have valid URL format
 *
 * @param url - URL to validate
 * @returns true if URL is valid external image URL
 *
 * @example
 * isValidExternalImageUrl('https://example.com/image.png') // true
 * isValidExternalImageUrl('http://example.com/image.png') // false (not HTTPS)
 * isValidExternalImageUrl('/relative/image.png') // false (not absolute)
 */
export function isValidExternalImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Must use HTTPS protocol
    if (parsed.protocol !== 'https:') {
      return false;
    }

    // Must have a hostname (not empty)
    if (!parsed.hostname) {
      return false;
    }

    return true;
  } catch (error) {
    // Invalid URL format
    return false;
  }
}
