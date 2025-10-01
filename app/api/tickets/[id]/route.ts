import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { Stage, isValidTransition } from '@/lib/stage-validation';

const prisma = new PrismaClient();

/**
 * Zod schema for validating stage update requests
 */
const UpdateStageSchema = z.object({
  stage: z.nativeEnum(Stage),
  version: z.number().int().positive(),
});

/**
 * PATCH /api/tickets/[id]
 * Update ticket stage with optimistic concurrency control
 *
 * Request Body:
 * {
 *   "stage": "PLAN",
 *   "version": 1
 * }
 *
 * Success Response (200):
 * {
 *   "id": 123,
 *   "stage": "PLAN",
 *   "version": 2,
 *   "updatedAt": "2025-10-01T12:34:56.789Z"
 * }
 *
 * Error Responses:
 * - 400: Invalid stage transition or malformed request
 * - 404: Ticket not found
 * - 409: Version conflict (ticket modified by another user)
 * - 500: Internal server error
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Await params in Next.js 15
    const params = await context.params;

    // Parse and validate ticket ID
    const ticketId = parseInt(params.id, 10);
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid ticket ID', message: 'Ticket ID must be a number' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = UpdateStageSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: 'Invalid request body',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { stage: newStage, version: requestVersion } = parseResult.data;

    // Fetch current ticket from database
    const currentTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!currentTicket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Check for version conflict (optimistic concurrency control)
    if (currentTicket.version !== requestVersion) {
      return NextResponse.json(
        {
          error: 'Ticket modified by another user',
          currentStage: currentTicket.stage,
          currentVersion: currentTicket.version,
        },
        { status: 409 }
      );
    }

    // Validate stage transition (sequential only)
    const currentStage = currentTicket.stage as Stage;
    if (!isValidTransition(currentStage, newStage)) {
      return NextResponse.json(
        {
          error: 'Invalid stage transition',
          message: `Cannot transition from ${currentStage} to ${newStage}. Tickets must progress sequentially through stages.`,
        },
        { status: 400 }
      );
    }

    // Update ticket atomically with version increment
    const updatedTicket = await prisma.ticket.update({
      where: {
        id: ticketId,
        version: requestVersion,
      },
      data: {
        stage: newStage,
        version: { increment: 1 },
      },
    });

    // Return successful response
    return NextResponse.json(
      {
        id: updatedTicket.id,
        stage: updatedTicket.stage,
        version: updatedTicket.version,
        updatedAt: updatedTicket.updatedAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating ticket stage:', error);

    // Handle Prisma errors
    if (error instanceof Error && 'code' in error) {
      const prismaError = error as { code: string; meta?: { cause?: string } };

      // P2025: Record not found (version mismatch in where clause)
      if (prismaError.code === 'P2025') {
        return NextResponse.json(
          {
            error: 'Ticket modified by another user',
            message:
              'The ticket was updated by someone else. Please refresh and try again.',
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
