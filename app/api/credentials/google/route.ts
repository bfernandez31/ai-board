import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserOrToken } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';

/**
 * Retrieve Google credential for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserOrToken(request);
    
    const credential = await prisma.userCredential.findFirst({
      where: {
        userId: user.id,
        provider: 'GOOGLE',
      },
      select: {
        id: true,
        provider: true,
        credentialType: true,
        label: true,
        preview: true,
        readinessStatus: true,
        lastVerifiedAt: true,
        verificationCode: true,
        verificationMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    if (!credential) {
      return NextResponse.json(
        { error: 'No Google credential found for this user' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      credential: {
        ...credential,
        lastVerifiedAt: credential.lastVerifiedAt?.toISOString() ?? null,
        createdAt: credential.createdAt.toISOString(),
        updatedAt: credential.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Failed to retrieve Google credential:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve Google credential' },
      { status: 500 }
    );
  }
}
