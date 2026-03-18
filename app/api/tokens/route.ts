import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUserOrToken } from "@/lib/db/users";
import { createToken, listTokens } from "@/lib/db/tokens";
import { generatePersonalAccessToken } from "@/lib/tokens/generate";

/**
 * Validation schema for token creation
 */
const createTokenSchema = z.object({
  name: z
    .string()
    .min(1, "Token name is required")
    .max(100, "Token name must be 100 characters or less"),
});

/**
 * GET /api/tokens
 *
 * List all personal access tokens for the authenticated user.
 * Returns token metadata only (no sensitive data).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserOrToken(request);

    const tokens = await listTokens(user.id);

    return NextResponse.json({
      tokens: tokens.map((token) => ({
        id: token.id,
        name: token.name,
        preview: token.preview,
        lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
        createdAt: token.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    console.error("Failed to list tokens:", error);
    return NextResponse.json(
      { error: "Failed to list tokens" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tokens
 *
 * Create a new personal access token.
 * Returns the full token ONCE - it cannot be retrieved again.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserOrToken(request);

    const body = await request.json();
    const validated = createTokenSchema.parse(body);

    // Generate token with cryptographically secure random bytes
    const { token, hash, salt, preview } = generatePersonalAccessToken();

    // Store token metadata (hash only, not plain text)
    const storedToken = await createToken(
      user.id,
      validated.name,
      hash,
      salt,
      preview
    );

    // Return full token ONCE for user to save
    return NextResponse.json(
      {
        id: storedToken.id,
        name: storedToken.name,
        token, // Full token - shown only once
        preview: storedToken.preview,
        createdAt: storedToken.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message || "Validation failed" },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    console.error("Failed to create token:", error);
    return NextResponse.json(
      { error: "Failed to create token" },
      { status: 500 }
    );
  }
}
