import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authorizeDevLogin,
  getDevLoginErrorMessage,
  isDevLoginEnabled,
} from '@/app/lib/auth/dev-login';

function createEnabledDevEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    DEV_LOGIN_SECRET: 'secret-1234567890',
  };
}

describe('dev-login auth helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isDevLoginEnabled', () => {
    it('returns false when no secret is configured', () => {
      expect(isDevLoginEnabled({ NODE_ENV: 'development' })).toBe(false);
    });

    it('returns true in development when the secret is configured', () => {
      expect(
        isDevLoginEnabled({
          NODE_ENV: 'development',
          DEV_LOGIN_SECRET: 'dev-secret-1234567890',
        })
      ).toBe(true);
    });

    it('returns true in Vercel preview deployments', () => {
      expect(
        isDevLoginEnabled({
          NODE_ENV: 'production',
          VERCEL_ENV: 'preview',
          DEV_LOGIN_SECRET: 'preview-secret-1234567890',
        })
      ).toBe(true);
    });

    it('returns false in production deployments', () => {
      expect(
        isDevLoginEnabled({
          NODE_ENV: 'production',
          VERCEL_ENV: 'production',
          DEV_LOGIN_SECRET: 'prod-secret-1234567890',
        })
      ).toBe(false);
    });
  });

  describe('authorizeDevLogin', () => {
    it('returns null when dev login is disabled', async () => {
      const createUser = vi.fn();

      const result = await authorizeDevLogin(
        {
          email: 'preview@example.com',
          secret: 'secret-1234567890',
        },
        {
          env: { NODE_ENV: 'production' },
          createUser,
        }
      );

      expect(result).toBeNull();
      expect(createUser).not.toHaveBeenCalled();
    });

    it('returns null when the email is invalid', async () => {
      const createUser = vi.fn();

      const result = await authorizeDevLogin(
        {
          email: 'not-an-email',
          secret: 'secret-1234567890',
        },
        {
          env: createEnabledDevEnv(),
          createUser,
        }
      );

      expect(result).toBeNull();
      expect(createUser).not.toHaveBeenCalled();
    });

    it('returns null when the secret does not match', async () => {
      const createUser = vi.fn();

      const result = await authorizeDevLogin(
        {
          email: 'preview@example.com',
          secret: 'wrong-secret',
        },
        {
          env: createEnabledDevEnv(),
          createUser,
        }
      );

      expect(result).toBeNull();
      expect(createUser).not.toHaveBeenCalled();
    });

    it('creates or updates the user when credentials are valid', async () => {
      const createUser = vi.fn().mockResolvedValue({
        id: 'user-123',
        email: 'preview@example.com',
      });

      const result = await authorizeDevLogin(
        {
          email: 'preview@example.com',
          secret: 'secret-1234567890',
        },
        {
          env: createEnabledDevEnv(),
          createUser,
        }
      );

      expect(createUser).toHaveBeenCalledWith('preview@example.com');
      expect(result).toEqual({
        id: 'user-123',
        email: 'preview@example.com',
        name: 'preview@example.com',
      });
    });
  });

  describe('getDevLoginErrorMessage', () => {
    it('returns a user-facing message for credentials failures', () => {
      expect(getDevLoginErrorMessage('CredentialsSignin')).toMatch(/invalid email or secret/i);
    });

    it('returns null for non-dev-login errors', () => {
      expect(getDevLoginErrorMessage('AccessDenied')).toBeNull();
    });
  });
});
