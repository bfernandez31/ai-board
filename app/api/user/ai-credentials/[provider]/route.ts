import { NextRequest, NextResponse } from 'next/server';
import { AiProvider } from '@prisma/client';
import { getCurrentUserOrToken } from '@/lib/db/users';
import { deleteUserAiCredential } from '@/lib/db/ai-credentials';
import { AiProviderSchema } from '@/lib/ai/credentials';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
): Promise<NextResponse> {
  try {
    const user = await getCurrentUserOrToken(request);
    const params = await context.params;
    const parsedProvider = AiProviderSchema.safeParse(params.provider);

    if (!parsedProvider.success) {
      return NextResponse.json({ error: 'Unsupported AI provider' }, { status: 400 });
    }

    const deleted = await deleteUserAiCredential(user.id, parsedProvider.data as AiProvider);

    if (!deleted) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Credential deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Failed to delete AI credential:', error);
    return NextResponse.json({ error: 'Failed to delete AI credential' }, { status: 500 });
  }
}
