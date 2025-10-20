/**
 * Unit tests for markdown parser module
 */

import { describe, it, expect } from 'vitest';
import { extractImageUrls, isValidExternalImageUrl } from '../../app/lib/parsers/markdown';

describe('extractImageUrls', () => {
  it('should extract single image URL from markdown', () => {
    const markdown = '![Mockup](https://example.com/mockup.png)';
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      alt: 'Mockup',
      url: 'https://example.com/mockup.png',
    });
  });

  it('should extract multiple image URLs from markdown', () => {
    const markdown = `
# Title

![First image](https://example.com/first.png)

Some text here.

![Second image](https://example.com/second.jpg)
    `;
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      alt: 'First image',
      url: 'https://example.com/first.png',
    });
    expect(result[1]).toEqual({
      alt: 'Second image',
      url: 'https://example.com/second.jpg',
    });
  });

  it('should handle empty alt text', () => {
    const markdown = '![](https://example.com/image.png)';
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      alt: 'Image', // Default alt text
      url: 'https://example.com/image.png',
    });
  });

  it('should trim whitespace from alt text and URL', () => {
    const markdown = '![  Mockup with spaces  ](  https://example.com/image.png  )';
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      alt: 'Mockup with spaces',
      url: 'https://example.com/image.png',
    });
  });

  it('should ignore relative image URLs', () => {
    const markdown = '![Relative](./images/local.png)';
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(0);
  });

  it('should ignore non-HTTPS URLs', () => {
    const markdown = '![HTTP image](http://example.com/image.png)';
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(0);
  });

  it('should ignore FTP URLs', () => {
    const markdown = '![FTP image](ftp://example.com/image.png)';
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(0);
  });

  it('should extract only HTTPS images from mixed URLs', () => {
    const markdown = `
![Valid HTTPS](https://example.com/valid.png)
![HTTP](http://example.com/http.png)
![Relative](./local.png)
![Another valid](https://example.com/another.png)
    `;
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(2);
    expect(result[0].url).toBe('https://example.com/valid.png');
    expect(result[1].url).toBe('https://example.com/another.png');
  });

  it('should handle URLs with query parameters', () => {
    const markdown = '![Image](https://example.com/image.png?size=large&format=webp)';
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/image.png?size=large&format=webp');
  });

  it('should handle URLs with fragments', () => {
    const markdown = '![Image](https://example.com/page.html#image-section)';
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/page.html#image-section');
  });

  it('should handle Figma URLs', () => {
    const markdown = '![Figma mockup](https://figma.com/file/abc123/design?node-id=1:2)';
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://figma.com/file/abc123/design?node-id=1:2');
  });

  it('should return empty array for markdown without images', () => {
    const markdown = `
# Title

This is just text.

- List item 1
- List item 2

[Regular link](https://example.com)
    `;
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(0);
  });

  it('should ignore inline code blocks with image syntax', () => {
    const markdown = 'Use `![alt](url)` syntax for images.';
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(0);
  });

  it('should handle alt text with special characters', () => {
    const markdown = '![Alt with "quotes" and (parentheses)](https://example.com/image.png)';
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(1);
    expect(result[0].alt).toBe('Alt with "quotes" and (parentheses)');
  });

  it('should handle URLs with encoded characters', () => {
    const markdown = '![Image](https://example.com/path%20with%20spaces/image.png)';
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/path%20with%20spaces/image.png');
  });

  it('should handle multiple images on the same line', () => {
    const markdown = '![First](https://example.com/1.png) and ![Second](https://example.com/2.png)';
    const result = extractImageUrls(markdown);

    expect(result).toHaveLength(2);
    expect(result[0].url).toBe('https://example.com/1.png');
    expect(result[1].url).toBe('https://example.com/2.png');
  });
});

describe('isValidExternalImageUrl', () => {
  it('should return true for valid HTTPS URLs', () => {
    const validUrls = [
      'https://example.com/image.png',
      'https://example.com/path/to/image.jpg',
      'https://subdomain.example.com/image.gif',
      'https://example.com/image.png?size=large',
      'https://example.com/page.html#section',
    ];

    validUrls.forEach((url) => {
      expect(isValidExternalImageUrl(url)).toBe(true);
    });
  });

  it('should return false for HTTP URLs', () => {
    expect(isValidExternalImageUrl('http://example.com/image.png')).toBe(false);
  });

  it('should return false for relative URLs', () => {
    const relativeUrls = [
      './image.png',
      '../images/photo.jpg',
      '/absolute/path/image.png',
      'image.png',
    ];

    relativeUrls.forEach((url) => {
      expect(isValidExternalImageUrl(url)).toBe(false);
    });
  });

  it('should return false for FTP URLs', () => {
    expect(isValidExternalImageUrl('ftp://example.com/image.png')).toBe(false);
  });

  it('should return false for file:// URLs', () => {
    expect(isValidExternalImageUrl('file:///path/to/image.png')).toBe(false);
  });

  it('should return false for data URLs', () => {
    expect(isValidExternalImageUrl('data:image/png;base64,iVBORw0KGgo...')).toBe(false);
  });

  it('should return false for invalid URL format', () => {
    const invalidUrls = [
      'not a url',
      'https://',
      'https:///',
      '://example.com',
      '',
    ];

    invalidUrls.forEach((url) => {
      expect(isValidExternalImageUrl(url)).toBe(false);
    });
  });

  it('should return false for URLs without hostname', () => {
    expect(isValidExternalImageUrl('https:///path/to/image.png')).toBe(false);
  });

  it('should accept URLs with ports', () => {
    expect(isValidExternalImageUrl('https://example.com:8080/image.png')).toBe(true);
  });

  it('should accept URLs with authentication (though not recommended)', () => {
    expect(isValidExternalImageUrl('https://user:pass@example.com/image.png')).toBe(true);
  });

  it('should accept URLs with international domain names', () => {
    expect(isValidExternalImageUrl('https://münchen.de/image.png')).toBe(true);
  });

  it('should accept URLs with long paths', () => {
    const longPath = 'a/'.repeat(50);
    expect(isValidExternalImageUrl(`https://example.com/${longPath}image.png`)).toBe(true);
  });
});
