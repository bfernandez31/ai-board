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
  } catch {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    )
  }
}
