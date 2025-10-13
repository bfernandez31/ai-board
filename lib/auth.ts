import NextAuth from "next-auth"
import type { Adapter } from "next-auth/adapters"
import GitHub from "next-auth/providers/github"

// Conditional imports to reduce Edge Runtime bundle size
// Only import Prisma in test mode (database sessions)
// Production uses JWT strategy which doesn't need database adapter
let adapter: Adapter | undefined
if (process.env.NODE_ENV === 'test') {
  const { PrismaAdapter } = await import("@auth/prisma-adapter")
  const { prisma } = await import("@/lib/db/client")
  adapter = PrismaAdapter(prisma)
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
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token, user }) {
      // In test mode with database sessions, user comes from database
      // In production with JWT, user.id comes from token
      if (session.user) {
        session.user.id = (user?.id || token?.id) as string
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
