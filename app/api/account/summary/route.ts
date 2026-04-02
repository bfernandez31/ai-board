import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/db/users"
import { prisma } from "@/lib/db/client"

export async function GET() {
  try {
    const user = await getCurrentUser()

    const [projectCount, credentialCount, tokenCount, subscription] =
      await Promise.all([
        prisma.project.count({ where: { userId: user.id } }),
        prisma.userCredential.count({ where: { userId: user.id } }),
        prisma.personalAccessToken.count({ where: { userId: user.id } }),
        prisma.subscription.findUnique({
          where: { userId: user.id },
          select: { status: true, plan: true },
        }),
      ])

    const hasActiveSubscription =
      subscription?.status === "ACTIVE" || subscription?.status === "TRIALING"

    return NextResponse.json({
      projectCount,
      credentialCount,
      tokenCount,
      hasActiveSubscription,
      plan: subscription?.plan ?? "FREE",
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Account summary error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
