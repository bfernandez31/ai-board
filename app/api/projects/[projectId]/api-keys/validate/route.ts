import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { ApiKeyProvider } from "@prisma/client";
import { verifyProjectOwnership } from "@/lib/db/auth-helpers";

const validateKeySchema = z.object({
  provider: z.nativeEnum(ApiKeyProvider),
  key: z.string().min(10).max(500),
});

/**
 * POST /api/projects/[projectId]/api-keys/validate
 * Test an API key by making a lightweight call to the provider.
 * The key is NOT stored - only tested for validity.
 */
export async function POST(
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
    const { provider, key } = validateKeySchema.parse(body);

    const result = await validateApiKey(provider, key);

    return NextResponse.json(result);
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
    console.error("Error validating API key:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const PROVIDER_ENDPOINTS: Record<
  ApiKeyProvider,
  { url: string; headers: (key: string) => Record<string, string> }
> = {
  [ApiKeyProvider.ANTHROPIC]: {
    url: "https://api.anthropic.com/v1/models",
    headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
  },
  [ApiKeyProvider.OPENAI]: {
    url: "https://api.openai.com/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
};

async function validateApiKey(
  provider: ApiKeyProvider,
  key: string
): Promise<{ valid: boolean; error?: string }> {
  const endpoint = PROVIDER_ENDPOINTS[provider];
  if (!endpoint) {
    return { valid: false, error: "Unknown provider" };
  }

  try {
    const response = await fetch(endpoint.url, {
      method: "GET",
      headers: endpoint.headers(key),
    });

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }

    return { valid: false, error: `API returned status ${response.status}` };
  } catch {
    return { valid: false, error: "Failed to reach provider API" };
  }
}
