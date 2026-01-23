import { headers } from 'next/headers';
import { validateToken } from '@/lib/db/tokens';
import { isValidTokenFormat } from '@/lib/auth/token-utils';

/**
 * Get user ID from Bearer token in Authorization header
 * @returns User ID if valid token, null otherwise
 */
export async function getUserIdFromBearerToken(): Promise<string | null> {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!isValidTokenFormat(token)) return null;

  return validateToken(token);
}
