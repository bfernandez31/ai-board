import { prisma } from "@/lib/db/client"
import type { Account } from "next-auth"

export interface GitHubProfile {
  id: number
  email: string
  name: string | null
  login: string
  avatar_url: string
  email_verified?: boolean
}

export function validateGitHubProfile(profile: unknown): profile is GitHubProfile {
  const p = profile as Record<string, unknown> | null | undefined
  if (!p?.email) {
    console.error("GitHub profile missing email", {
      providerId: p?.id,
      timestamp: new Date().toISOString(),
    })
    return false
  }

  return true
}

function getGitHubDisplayName(profile: GitHubProfile): string {
  return profile.name || profile.login
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function createOrUpdateUser(
  profile: GitHubProfile,
  account: Account,
): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const githubUserId = String(profile.id)
    const displayName = getGitHubDisplayName(profile)
    const now = new Date()

    const user = await tx.user.upsert({
      where: { email: profile.email },
      update: {
        name: displayName,
        image: profile.avatar_url,
        updatedAt: now,
      },
      create: {
        id: githubUserId,
        email: profile.email,
        name: displayName,
        emailVerified: now,
        image: profile.avatar_url,
        updatedAt: now,
      },
    })

    await tx.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "github",
          providerAccountId: githubUserId,
        },
      },
      update: {
        access_token: account.access_token ?? null,
        refresh_token: account.refresh_token ?? null,
        expires_at: account.expires_at ?? null,
      },
      create: {
        id: crypto.randomUUID(),
        userId: user.id,
        type: "oauth",
        provider: "github",
        providerAccountId: githubUserId,
        access_token: account.access_token ?? null,
        refresh_token: account.refresh_token ?? null,
        expires_at: account.expires_at ?? null,
        token_type: account.token_type ?? null,
        scope: account.scope ?? null,
        id_token: account.id_token ?? null,
      },
    })

    return { id: user.id }
  })
}

export async function createOrUpdateDevLoginUser(
  email: string,
): Promise<{ id: string; email: string; name: string | null }> {
  return prisma.$transaction(async (tx) => {
    const normalizedEmail = normalizeEmail(email)
    const now = new Date()

    const user = await tx.user.upsert({
      where: { email: normalizedEmail },
      update: {
        email: normalizedEmail,
        name: normalizedEmail,
        emailVerified: now,
        updatedAt: now,
      },
      create: {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        name: normalizedEmail,
        emailVerified: now,
        updatedAt: now,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    await tx.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "credentials",
          providerAccountId: normalizedEmail,
        },
      },
      update: {
        userId: user.id,
        type: "credentials",
      },
      create: {
        id: crypto.randomUUID(),
        userId: user.id,
        type: "credentials",
        provider: "credentials",
        providerAccountId: normalizedEmail,
      },
    })

    return user
  })
}
