import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getCurrentUser, deleteUserAccount } from "@/lib/db/users"

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
]

export async function DELETE() {
  try {
    const user = await getCurrentUser()

    await deleteUserAccount(user.id)

    const cookieStore = await cookies()
    for (const name of SESSION_COOKIE_NAMES) {
      cookieStore.delete(name)
    }

    return NextResponse.json({ message: "Account deleted successfully" })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.error("Failed to delete account:", error)
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    )
  }
}
