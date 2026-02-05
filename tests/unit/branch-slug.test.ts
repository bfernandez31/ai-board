import { describe, it, expect } from 'vitest';
import { generateBranchName } from '@/lib/github/branch-operations';

/**
 * Unit tests for generateBranchName function
 *
 * Tests verify:
 * - Basic slug generation with ticket number prefix
 * - Handling of special characters (removed)
 * - Limiting to first 3 words
 * - Handling of mixed case (lowercased)
 * - Handling of multiple spaces
 * - Edge cases (empty title, numbers in title)
 */

describe('generateBranchName', () => {
  it('should generate branch name with ticket number and slug from title', () => {
    const result = generateBranchName(219, 'Add Full Clone Option');
    expect(result).toBe('219-add-full-clone');
  });

  it('should limit slug to first 3 words', () => {
    const result = generateBranchName(100, 'This is a very long ticket title');
    expect(result).toBe('100-this-is-a');
  });

  it('should remove special characters from slug', () => {
    const result = generateBranchName(42, "Add User's Profile (Admin)");
    expect(result).toBe('42-add-users-profile');
  });

  it('should convert title to lowercase', () => {
    const result = generateBranchName(1, 'ADD UPPERCASE TITLE');
    expect(result).toBe('1-add-uppercase-title');
  });

  it('should handle multiple spaces between words', () => {
    const result = generateBranchName(123, 'Fix   the    bug');
    expect(result).toBe('123-fix-the-bug');
  });

  it('should handle leading and trailing spaces', () => {
    const result = generateBranchName(50, '  Trim spaces around  ');
    expect(result).toBe('50-trim-spaces-around');
  });

  it('should handle title with only one word', () => {
    const result = generateBranchName(7, 'Refactor');
    expect(result).toBe('7-refactor');
  });

  it('should handle title with two words', () => {
    const result = generateBranchName(8, 'Fix bug');
    expect(result).toBe('8-fix-bug');
  });

  it('should handle empty title', () => {
    const result = generateBranchName(99, '');
    expect(result).toBe('99-');
  });

  it('should handle title with only special characters', () => {
    const result = generateBranchName(101, '!@#$%^&*()');
    expect(result).toBe('101-');
  });

  it('should handle title with numbers', () => {
    const result = generateBranchName(200, 'Fix Issue 123');
    expect(result).toBe('200-fix-issue-123');
  });

  it('should handle mixed alphanumeric and special characters', () => {
    const result = generateBranchName(300, 'Add feature-flag for v2.0');
    expect(result).toBe('300-add-featureflag-for');
  });

  it('should handle accented characters (removed)', () => {
    const result = generateBranchName(400, 'Résumé création rapide');
    expect(result).toBe('400-rsum-cration-rapide');
  });

  it('should handle Copy of prefix (from simple copy)', () => {
    const result = generateBranchName(500, 'Copy of Original Feature');
    expect(result).toBe('500-copy-of-original');
  });

  it('should handle Clone of prefix (from full clone)', () => {
    const result = generateBranchName(600, 'Clone of Original Feature');
    expect(result).toBe('600-clone-of-original');
  });
});
