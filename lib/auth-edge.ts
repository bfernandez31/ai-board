// Edge-compatible auth for middleware
// This file does NOT import Prisma or any server-only code

import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"

export const { auth: authEdge } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt", // JWT only for Edge
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
})
