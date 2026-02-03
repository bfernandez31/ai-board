/**
 * Unit Test: Ticket Validation Schemas
 *
 * Tests validation logic for ticket creation and updates, focusing on:
 * - Title validation (restricted character set)
 * - Description validation (all UTF-8 characters allowed)
 * - Length constraints
 * - Field schemas
 */

import { describe, it, expect } from 'vitest';
import {
  TitleFieldSchema,
  DescriptionFieldSchema,
  CreateTicketSchema,
  descriptionSchema,
  titleSchema,
} from '@/lib/validations/ticket';

describe('TitleFieldSchema', () => {
  describe('valid titles', () => {
    it('should accept basic alphanumeric titles', () => {
      const result = TitleFieldSchema.safeParse('Test ticket 123');
      expect(result.success).toBe(true);
    });

    it('should accept titles with allowed punctuation', () => {
      const validPunctuation = [
        'Test, ticket! How? Yes-it works.',
        'Bug: Login fails',
        "User's profile (new)",
        'Feature [URGENT]',
        'Fix: API endpoint #123',
        'Test $100 payment',
      ];

      validPunctuation.forEach((title) => {
        const result = TitleFieldSchema.safeParse(title);
        expect(result.success).toBe(true);
      });
    });

    it('should accept title with maximum length (100 chars)', () => {
      const maxTitle = 'a'.repeat(100);
      const result = TitleFieldSchema.safeParse(maxTitle);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid titles', () => {
    it('should reject empty title', () => {
      const result = TitleFieldSchema.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Title is required');
      }
    });

    it('should reject title exceeding 100 characters', () => {
      const tooLongTitle = 'a'.repeat(101);
      const result = TitleFieldSchema.safeParse(tooLongTitle);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Title must be 100 characters or less');
      }
    });

    it('should reject title with emoji', () => {
      const result = TitleFieldSchema.safeParse('Test ticket 🚀');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('can only contain');
      }
    });

    it('should reject title with other Unicode characters', () => {
      const unicodeTitles = [
        'Test ticket 中文',
        'Test ticket العربية',
        'Test ticket 日本語',
      ];

      unicodeTitles.forEach((title) => {
        const result = TitleFieldSchema.safeParse(title);
        expect(result.success).toBe(false);
      });
    });
  });
});

describe('DescriptionFieldSchema', () => {
  describe('valid descriptions', () => {
    it('should accept basic alphanumeric descriptions', () => {
      const result = DescriptionFieldSchema.safeParse('Test description');
      expect(result.success).toBe(true);
    });

    it('should accept description with UTF-8 characters (emoji)', () => {
      const result = DescriptionFieldSchema.safeParse('Description with emoji 🚀 and more text');
      expect(result.success).toBe(true);
    });

    it('should accept description with Chinese characters', () => {
      const result = DescriptionFieldSchema.safeParse('Description with 中文字符');
      expect(result.success).toBe(true);
    });

    it('should accept description with Arabic characters', () => {
      const result = DescriptionFieldSchema.safeParse('Description with العربية');
      expect(result.success).toBe(true);
    });

    it('should accept description with Japanese characters', () => {
      const result = DescriptionFieldSchema.safeParse('Description with 日本語');
      expect(result.success).toBe(true);
    });

    it('should accept description with Cyrillic characters', () => {
      const result = DescriptionFieldSchema.safeParse('Description with Русский текст');
      expect(result.success).toBe(true);
    });

    it('should accept description with mixed UTF-8 characters', () => {
      const result = DescriptionFieldSchema.safeParse(
        'Mixed: English, 中文, العربية, 日本語, Русский 🚀🎉'
      );
      expect(result.success).toBe(true);
    });

    it('should accept description with special symbols', () => {
      const result = DescriptionFieldSchema.safeParse(
        'Symbols: ©️ ®️ ™️ € £ ¥ § ¶ † ‡ • … ′ ″'
      );
      expect(result.success).toBe(true);
    });

    it('should accept description with mathematical symbols', () => {
      const result = DescriptionFieldSchema.safeParse(
        'Math: ∞ ∑ ∫ ∂ ∇ √ ≈ ≠ ≤ ≥ ± × ÷'
      );
      expect(result.success).toBe(true);
    });

    it('should accept description with maximum length (10000 chars)', () => {
      const maxDescription = 'a'.repeat(10000);
      const result = DescriptionFieldSchema.safeParse(maxDescription);
      expect(result.success).toBe(true);
    });

    it('should accept description with newlines and tabs', () => {
      const result = DescriptionFieldSchema.safeParse('Line 1\nLine 2\tTabbed');
      expect(result.success).toBe(true);
    });
  });

  describe('invalid descriptions', () => {
    it('should reject empty description', () => {
      const result = DescriptionFieldSchema.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Description is required');
      }
    });

    it('should reject description exceeding 10000 characters', () => {
      const tooLongDescription = 'a'.repeat(10001);
      const result = DescriptionFieldSchema.safeParse(tooLongDescription);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Description must be 10000 characters or less');
      }
    });
  });
});

describe('CreateTicketSchema', () => {
  it('should accept valid ticket with title and description', () => {
    const result = CreateTicketSchema.safeParse({
      title: 'Valid title',
      description: 'Valid description',
    });
    expect(result.success).toBe(true);
  });

  it('should accept ticket with UTF-8 description', () => {
    const result = CreateTicketSchema.safeParse({
      title: 'Valid title',
      description: 'Description with emoji 🚀 and Chinese 中文',
    });
    expect(result.success).toBe(true);
  });

  it('should trim whitespace from title and description', () => {
    const result = CreateTicketSchema.safeParse({
      title: '   Valid title   ',
      description: '   Valid description   ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Valid title');
      expect(result.data.description).toBe('Valid description');
    }
  });

  it('should reject ticket with emoji in title', () => {
    const result = CreateTicketSchema.safeParse({
      title: 'Test 🚀',
      description: 'Valid description',
    });
    expect(result.success).toBe(false);
  });

  it('should accept ticket with emoji in description only', () => {
    const result = CreateTicketSchema.safeParse({
      title: 'Valid title',
      description: 'Valid description with emoji 🚀',
    });
    expect(result.success).toBe(true);
  });
});

describe('descriptionSchema (patch)', () => {
  it('should accept description with UTF-8 characters', () => {
    const result = descriptionSchema.safeParse('Description with 中文 and emoji 🚀');
    expect(result.success).toBe(true);
  });

  it('should trim whitespace', () => {
    const result = descriptionSchema.safeParse('   Description   ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('Description');
    }
  });

  it('should reject empty description after trim', () => {
    const result = descriptionSchema.safeParse('   ');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Description cannot be empty');
    }
  });
});

describe('titleSchema (patch)', () => {
  it('should reject title with emoji', () => {
    const result = titleSchema.safeParse('Title 🚀');
    expect(result.success).toBe(false);
  });

  it('should accept title with allowed characters', () => {
    const result = titleSchema.safeParse('Valid title 123');
    expect(result.success).toBe(true);
  });

  it('should trim whitespace', () => {
    const result = titleSchema.safeParse('   Title   ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('Title');
    }
  });
});
