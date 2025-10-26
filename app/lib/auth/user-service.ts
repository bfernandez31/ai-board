import { prisma } from '@/lib/db/client';
import type { Account } from 'next-auth';

/**
 * GitHub profile data from OAuth provider
 */
export interface GitHubProfile {
  id: number;
  email: string;
  name: string | null;
  login: string;
  avatar_url: string;
  email_verified?: boolean;
}

/**
 * Validates GitHub profile has required fields
 * @param profile - Profile data from GitHub OAuth
 * @returns True if profile is valid, false otherwise
 */
export function validateGitHubProfile(profile: any): profile is GitHubProfile {
  if (!profile?.email) {
    console.error('GitHub profile missing email', {
      providerId: profile?.id,
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  return true;
}

/**
 * Creates or updates User and Account records in database
 * Uses transaction to ensure atomicity
 * @param profile - Validated GitHub profile
 * @param account - NextAuth account data
 * @returns User ID
 */
export async function createOrUpdateUser(
  profile: GitHubProfile,
  account: Account
): Promise<{ id: string }> {
  return await prisma.$transaction(async (tx) => {
    // Upsert User record
    const user = await tx.user.upsert({
      where: { email: profile.email },
      update: {
        name: profile.name || profile.login,
        image: profile.avatar_url,
        updatedAt: new Date(),
      },
      create: {
        id: String(profile.id), // Use GitHub ID as User ID
        email: profile.email,
        name: profile.name || profile.login,
        emailVerified: new Date(),
        image: profile.avatar_url,
        updatedAt: new Date(),
      },
    });

    // Upsert Account record
    await tx.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'github',
          providerAccountId: String(profile.id),
        },
      },
      update: {
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
      },
      create: {
        id: crypto.randomUUID(),
        userId: user.id,
        type: 'oauth',
        provider: 'github',
        providerAccountId: String(profile.id),
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
      },
    });

    return { id: user.id };
  });
}
