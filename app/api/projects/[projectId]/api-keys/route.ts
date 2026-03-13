import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { ApiKeyProvider } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { verifyProjectOwnership } from "@/lib/db/auth-helpers";
import { encryptApiKey } from "@/lib/crypto/encrypt";

const upsertApiKeySchema = z.object({
  provider: z.nativeEnum(ApiKeyProvider),
  key: z.string().min(10).max(500),
});

const deleteApiKeySchema = z.object({
  provider: z.nativeEnum(ApiKeyProvider),
});

/**
 * GET /api/projects/[projectId]/api-keys
 * Returns configured API key providers with masked previews (never the actual keys).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);

    const apiKeys = await prisma.projectApiKey.findMany({
      where: { projectId },
      select: {
        id: true,
        provider: true,
        preview: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ apiKeys });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Project not found") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }
    console.error("Error fetching API keys:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/projects/[projectId]/api-keys
 * Create or update an API key for a provider.
 * The key is encrypted before storage and never returned.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);

    const body = await request.json();
    const { provider, key } = upsertApiKeySchema.parse(body);

    const encrypted = encryptApiKey(key);
    const preview = key.slice(-4);

    const keyData = {
      encryptedKey: encrypted.encryptedKey,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      preview,
    };

    const apiKey = await prisma.projectApiKey.upsert({
      where: {
        projectId_provider: { projectId, provider },
      },
      create: { projectId, provider, ...keyData },
      update: keyData,
      select: {
        id: true,
        provider: true,
        preview: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ apiKey });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Project not found") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      if (error.message.includes("API_KEY_ENCRYPTION_KEY")) {
        return NextResponse.json(
          { error: "Server encryption not configured" },
          { status: 500 }
        );
      }
    }
    console.error("Error saving API key:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[projectId]/api-keys
 * Remove an API key for a provider.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);

    const body = await request.json();
    const { provider } = deleteApiKeySchema.parse(body);

    await prisma.projectApiKey.delete({
      where: {
        projectId_provider: { projectId, provider },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Project not found") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }
    console.error("Error deleting API key:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
