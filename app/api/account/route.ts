import { NextResponse } from "next/server"
import { getCurrentUser, deleteUserAccount } from "@/lib/db/users"

export async function DELETE() {
  try {
    const user = await getCurrentUser()

    await deleteUserAccount(user.id)

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
