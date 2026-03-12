import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserOrToken } from "@/lib/db/users";
import { deleteToken } from "@/lib/db/tokens";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/tokens/:id
 *
 * Delete (revoke) a personal access token.
 * The token is immediately invalidated.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrToken(_request);
    const { id } = await params;

    // Validate ID format
    const tokenId = parseInt(id, 10);
    if (isNaN(tokenId)) {
      return NextResponse.json(
        { error: "Invalid token ID" },
        { status: 400 }
      );
    }

    // Delete token (only if owned by user)
    const deleted = await deleteToken(tokenId, user.id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Token not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Token deleted successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    console.error("Failed to delete token:", error);
    return NextResponse.json(
      { error: "Failed to delete token" },
      { status: 500 }
    );
  }
}
