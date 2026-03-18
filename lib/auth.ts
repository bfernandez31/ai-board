import NextAuth from "next-auth"
import type { Adapter } from "next-auth/adapters"
import type { Provider } from "next-auth/providers"
import Credentials from "next-auth/providers/credentials"
import GitHub from "next-auth/providers/github"
import { authorizeDevLogin, DEV_LOGIN_PROVIDER_ID, isDevLoginEnabled } from "@/app/lib/auth/dev-login"
import { createOrUpdateUser, validateGitHubProfile } from "@/app/lib/auth/user-service"

let adapter: Adapter | undefined
if (process.env.NODE_ENV === "test") {
  const { PrismaAdapter } = await import("@auth/prisma-adapter")
  const { prisma } = await import("@/lib/db/client")
  adapter = PrismaAdapter(prisma)
}

const authSecret =
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV === "test" ? "test-secret-min-32-chars-long-for-nextauth" : undefined)

const providers: Provider[] = [
  GitHub({
    clientId: process.env.GITHUB_ID!,
    clientSecret: process.env.GITHUB_SECRET!,
    authorization: {
      params: {
        scope: "read:user user:email",
      },
    },
  }),
]

if (isDevLoginEnabled()) {
  providers.push(
    Credentials({
      id: DEV_LOGIN_PROVIDER_ID,
      name: "Dev Login",
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        secret: {
          label: "Shared Secret",
          type: "password",
        },
      },
      authorize(credentials) {
        return authorizeDevLogin(credentials)
      },
    }),
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...(adapter ? { adapter } : {}),
  ...(authSecret ? { secret: authSecret } : {}),
  providers,

  callbacks: {
    async signIn({ user, account, profile }) {
      if (process.env.NODE_ENV === "test") {
        return true
      }

      if (account?.provider === DEV_LOGIN_PROVIDER_ID) {
        return true
      }

      if (account?.provider !== "github") {
        console.error("Unsupported provider", {
          provider: account?.provider,
          timestamp: new Date().toISOString(),
        })
        return false
      }

      if (!validateGitHubProfile(profile)) {
        return false
      }

      const startTime = Date.now()
      try {
        const { id: userId } = await createOrUpdateUser(profile, account)
        const duration = Date.now() - startTime

        console.log("User created/updated successfully", {
          email: profile.email,
          userId,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
        })

        user.id = userId

        return true
      } catch (error) {
        const duration = Date.now() - startTime

        console.error("Failed to create/update user during sign-in", {
          email: profile.email,
          provider: account.provider,
          duration: `${duration}ms`,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })

        return false
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
      if (session.user) {
        session.user.id = (user?.id || token?.id || token?.userId) as string
      }

      return session
    },
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },

  session: {
    strategy: process.env.NODE_ENV === "test" ? "database" : "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
})
