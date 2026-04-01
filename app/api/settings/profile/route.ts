import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { requireAuth } from "@/lib/db/users"
import { prisma } from "@/lib/db/client"

interface ProfileResponse {
  name: string
  email: string
  image: string | null
  githubUsername: string | null
  githubProfileUrl: string | null
  createdAt: string
  plan: string
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: { where: { provider: "github" }, take: 1 },
        subscription: { select: { plan: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const account = user.accounts[0]
    let githubUsername: string | null = null

    if (account?.access_token && account.providerAccountId) {
      try {
        const ghResponse = await fetch(
          `https://api.github.com/user/${account.providerAccountId}`,
          {
            headers: {
              Authorization: `Bearer ${account.access_token}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        )
        if (ghResponse.ok) {
          const ghData = await ghResponse.json()
          githubUsername = ghData.login ?? null
        }
      } catch {
        // GitHub API failure is non-fatal
      }
    }

    const name = user.name || githubUsername || "Unknown"
    const plan = user.subscription?.plan ?? "FREE"

    const response: ProfileResponse = {
      name,
      email: user.email,
      image: user.image ?? null,
      githubUsername,
      githubProfileUrl: githubUsername
        ? `https://github.com/${githubUsername}`
        : null,
      createdAt: user.createdAt.toISOString(),
      plan,
    }

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Profile API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
