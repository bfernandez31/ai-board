import type { Account, Profile, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import GithubProvider from 'next-auth/providers/github';
import { createOrUpdateUser, validateGitHubProfile } from './user-service';

export const authOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }: { user: User; account: Account | null; profile?: Profile }) {
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

        // Store userId in user object for JWT callback
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

    async jwt({ token, user }: { token: JWT; user?: User }) {
      // Add userId to JWT on sign-in
      // The user.id is set in signIn callback after createOrUpdateUser
      if (user?.id) {
        token.userId = user.id;
      }
      return token;
    },

    async session({ session, token }: { session: any; token: JWT }) {
      // Add userId from JWT to session
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt', // Required for Vercel serverless
  },
};
