import NextAuth from 'next-auth';
import { AuthError } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import { authorizeDevLogin } from '@/app/lib/auth/dev-login';
import {
  createOrUpdateUser,
  validateGitHubProfile,
} from '@/app/lib/auth/user-service';

let adapter: Adapter | undefined;
if (process.env.NODE_ENV === 'test') {
  const { PrismaAdapter } = await import('@auth/prisma-adapter');
  const { prisma } = await import('@/lib/db/client');
  adapter = PrismaAdapter(prisma);
}

const isTestEnvironment = process.env.NODE_ENV === 'test';
const credentialsProviderId = 'credentials';
const githubProviderId = 'github';
const testNextAuthSecret = 'test-secret-min-32-chars-long-for-nextauth';
const nextAuthSecret = getNextAuthSecret();

function getNextAuthSecret(): string | undefined {
  if (process.env.NEXTAUTH_SECRET) {
    return process.env.NEXTAUTH_SECRET;
  }

  return isTestEnvironment ? testNextAuthSecret : undefined;
}

async function authorizeCredentials(
  credentials:
    | Partial<Record<'email' | 'secret' | 'redirectTo', unknown>>
    | undefined
): Promise<Awaited<ReturnType<typeof authorizeDevLogin>>> {
  if (!credentials?.email || !credentials?.secret) {
    return null;
  }

  return authorizeDevLogin({
    email: String(credentials.email),
    secret: String(credentials.secret),
    redirectTo: credentials.redirectTo
      ? String(credentials.redirectTo)
      : undefined,
  });
}

function logUnsupportedProvider(provider: string | undefined): void {
  console.error('Unsupported provider', {
    provider,
    timestamp: new Date().toISOString(),
  });
}

function logUserPersistenceSuccess(
  email: string | null | undefined,
  userId: string,
  duration: number
): void {
  console.log('User created/updated successfully', {
    email,
    userId,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
  });
}

function logUserPersistenceFailure(
  email: string | null | undefined,
  provider: string,
  duration: number,
  error: unknown
): void {
  console.error('Failed to create/update user during sign-in', {
    email,
    provider,
    duration: `${duration}ms`,
    error: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString(),
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...(adapter ? { adapter } : {}),
  ...(nextAuthSecret ? { secret: nextAuthSecret } : {}),

  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email',
        },
      },
    }),
    Credentials({
      id: credentialsProviderId,
      name: 'Preview Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        secret: { label: 'Shared Secret', type: 'password' },
        redirectTo: { label: 'Redirect', type: 'text' },
      },
      authorize: authorizeCredentials,
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (isTestEnvironment) {
        return true;
      }

      if (account?.provider === credentialsProviderId) {
        return true;
      }

      if (account?.provider !== githubProviderId) {
        logUnsupportedProvider(account?.provider);
        return false;
      }

      if (!validateGitHubProfile(profile)) {
        return false;
      }

      const startTime = Date.now();

      try {
        const { id: userId } = await createOrUpdateUser(profile, account);
        const duration = Date.now() - startTime;

        logUserPersistenceSuccess(profile.email, userId, duration);
        user.id = userId;

        return true;
      } catch (error) {
        const duration = Date.now() - startTime;
        logUserPersistenceFailure(
          profile.email,
          account.provider,
          duration,
          error
        );
        return false;
      }
    },

    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token, user }) {
      if (session.user) {
        session.user.id = (user?.id || token?.id || token?.userId) as string;
      }
      return session;
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  session: {
    strategy: isTestEnvironment ? 'database' : 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
});

export { AuthError };
