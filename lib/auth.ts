import NextAuth from "next-auth"
import type { Adapter } from "next-auth/adapters"
import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import { createOrUpdateUser, createOrUpdateDevUser, validateGitHubProfile } from "@/app/lib/auth/user-service"
import { timingSafeEqual } from "crypto"

// Conditional imports to reduce Edge Runtime bundle size
// Only import Prisma in test mode (database sessions)
// Production uses JWT strategy which doesn't need database adapter
let adapter: Adapter | undefined
if (process.env.NODE_ENV === 'test') {
  const { PrismaAdapter } = await import("@auth/prisma-adapter")
  const { prisma } = await import("@/lib/db/client")
  adapter = PrismaAdapter(prisma)
}

function devLoginProvider() {
  return Credentials({
    id: "credentials",
    name: "Dev Login",
    credentials: {
      email: { label: "Email", type: "email" },
      secret: { label: "Secret", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email as string | undefined;
      const secret = credentials?.secret as string | undefined;
      const devSecret = process.env.DEV_LOGIN_SECRET;

      if (!email || !secret || !devSecret) {
        return null;
      }

      // Timing-safe comparison with buffer padding for different lengths
      const secretBuf = Buffer.from(secret);
      const expectedBuf = Buffer.from(devSecret);
      const maxLen = Math.max(secretBuf.length, expectedBuf.length);
      const paddedSecret = Buffer.alloc(maxLen);
      const paddedExpected = Buffer.alloc(maxLen);
      secretBuf.copy(paddedSecret);
      expectedBuf.copy(paddedExpected);

      if (!timingSafeEqual(paddedSecret, paddedExpected) || secretBuf.length !== expectedBuf.length) {
        return null;
      }

      return createOrUpdateDevUser(email);
    },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...(adapter ? { adapter } : {}),

  // Use test secret in test environment
  ...(process.env.NEXTAUTH_SECRET || process.env.NODE_ENV === 'test'
    ? { secret: process.env.NEXTAUTH_SECRET || 'test-secret-min-32-chars-long-for-nextauth' }
    : {}),

  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email"
        }
      }
    }),
    ...(process.env.DEV_LOGIN_SECRET ? [devLoginProvider()] : []),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      // Skip database persistence in test mode (uses PrismaAdapter)
      if (process.env.NODE_ENV === 'test') {
        return true;
      }

      // Allow credentials provider (dev login) — user already validated in authorize()
      if (account?.provider === 'credentials') {
        return true;
      }

      // Validate provider
      if (account?.provider !== 'github') {
        console.error('Unsupported provider', {
          provider: account?.provider,
          timestamp: new Date().toISOString(),
        });
        return false;
      }

      // Validate profile
      if (!validateGitHubProfile(profile)) {
        return false; // Reject authentication
      }

      // Create or update user in database
      const startTime = Date.now();
      try {
        const { id: userId } = await createOrUpdateUser(profile, account);
        const duration = Date.now() - startTime;

        console.log('User created/updated successfully', {
          email: profile.email,
          userId: userId,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
        });

        // CRITICAL: Override user.id with database ID
        // This ensures the JWT token gets the correct database user ID,
        // not the OAuth provider ID which may change
        user.id = userId;

        return true; // Allow authentication
      } catch (error) {
        const duration = Date.now() - startTime;

        console.error('Failed to create/update user during sign-in', {
          email: profile.email,
          provider: account.provider,
          duration: `${duration}ms`,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });

        return false; // Reject authentication
      }
    },

    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id
        token.userId = user.id
      }
      return token
    },
    async session({ session, token, user }) {
      // In test mode with database sessions, user comes from database
      // In production with JWT, user.id comes from token
      if (session.user) {
        session.user.id = (user?.id || token?.id || token?.userId) as string
      }
      return session
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  session: {
    strategy: process.env.NODE_ENV === 'test' ? "database" : "jwt", // Use database for tests, JWT for production
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
})
