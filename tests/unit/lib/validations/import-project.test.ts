import { describe, it, expect } from 'vitest';
import { importProjectSchema } from '@/lib/validations/import-project';

describe('importProjectSchema', () => {
  it('accepts valid input with required fields only', () => {
    const result = importProjectSchema.safeParse({
      githubOwner: 'octocat',
      githubRepo: 'my-app',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.githubOwner).toBe('octocat');
      expect(result.data.githubRepo).toBe('my-app');
      expect(result.data.name).toBeUndefined();
      expect(result.data.description).toBeUndefined();
    }
  });

  it('accepts valid input with all fields', () => {
    const result = importProjectSchema.safeParse({
      githubOwner: 'octocat',
      githubRepo: 'my-app',
      name: 'My App',
      description: 'My awesome application',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('My App');
      expect(result.data.description).toBe('My awesome application');
    }
  });

  it('rejects empty githubOwner', () => {
    const result = importProjectSchema.safeParse({
      githubOwner: '',
      githubRepo: 'my-app',
    });

    expect(result.success).toBe(false);
  });

  it('rejects empty githubRepo', () => {
    const result = importProjectSchema.safeParse({
      githubOwner: 'octocat',
      githubRepo: '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects missing githubOwner', () => {
    const result = importProjectSchema.safeParse({
      githubRepo: 'my-app',
    });

    expect(result.success).toBe(false);
  });

  it('rejects missing githubRepo', () => {
    const result = importProjectSchema.safeParse({
      githubOwner: 'octocat',
    });

    expect(result.success).toBe(false);
  });

  it('rejects githubOwner exceeding 100 characters', () => {
    const result = importProjectSchema.safeParse({
      githubOwner: 'a'.repeat(101),
      githubRepo: 'my-app',
    });

    expect(result.success).toBe(false);
  });

  it('rejects githubRepo exceeding 100 characters', () => {
    const result = importProjectSchema.safeParse({
      githubOwner: 'octocat',
      githubRepo: 'a'.repeat(101),
    });

    expect(result.success).toBe(false);
  });

  it('rejects name exceeding 255 characters', () => {
    const result = importProjectSchema.safeParse({
      githubOwner: 'octocat',
      githubRepo: 'my-app',
      name: 'a'.repeat(256),
    });

    expect(result.success).toBe(false);
  });
});
