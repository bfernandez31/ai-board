import { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import { createOrUpdateUser, validateGitHubProfile } from './user-service';

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
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
        await createOrUpdateUser(profile, account);
        const duration = Date.now() - startTime;

        console.log('User created/updated successfully', {
          email: profile.email,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
        });

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
      // Add userId to JWT on first sign-in
      if (user) {
        token.userId = user.id;
      }
      return token;
    },

    async session({ session, token }) {
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
