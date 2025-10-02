import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { Stage, isValidTransition } from '@/lib/stage-validation';
import { patchTicketSchema } from '@/lib/validations/ticket';

const prisma = new PrismaClient();

/**
 * Zod schema for validating stage update requests
 */
const UpdateStageSchema = z.object({
  stage: z.nativeEnum(Stage),
  version: z.number().int().positive(),
});

/**
 * GET /api/tickets/[id]
 * Get a single ticket by ID
 *
 * Success Response (200):
 * {
 *   "id": 123,
 *   "title": "...",
 *   "description": "...",
 *   "stage": "PLAN",
 *   "version": 2,
 *   "createdAt": "2025-10-01T12:34:56.789Z",
 *   "updatedAt": "2025-10-01T12:34:56.789Z"
 * }
 *
 * Error Responses:
 * - 400: Invalid ticket ID
 * - 404: Ticket not found
 * - 500: Internal server error
 */
export async function GET(
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

    // Fetch ticket from database
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Return ticket
    return NextResponse.json(
      {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        stage: ticket.stage,
        version: ticket.version,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * PATCH /api/tickets/[id]
 * Update ticket stage OR title/description with optimistic concurrency control
 *
 * Request Body (Stage Update):
 * {
 *   "stage": "PLAN",
 *   "version": 1
 * }
 *
 * Request Body (Inline Edit):
 * {
 *   "title"?: "Updated Title",
 *   "description"?: "Updated Description",
 *   "version": 1
 * }
 *
 * Success Response (200):
 * {
 *   "id": 123,
 *   "title": "...",
 *   "description": "...",
 *   "stage": "PLAN",
 *   "version": 2,
 *   "createdAt": "2025-10-01T12:34:56.789Z",
 *   "updatedAt": "2025-10-01T12:34:56.789Z"
 * }
 *
 * Error Responses:
 * - 400: Invalid request or validation error
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

    // Parse request body
    const body = await request.json();

    // Determine operation type based on request body
    const isStageUpdate = 'stage' in body;
    const isInlineEdit = 'title' in body || 'description' in body;

    if (isStageUpdate && isInlineEdit) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'Cannot update stage and title/description in the same request',
        },
        { status: 400 }
      );
    }

    // Handle inline edit (title/description update)
    if (isInlineEdit) {
      const parseResult = patchTicketSchema.safeParse(body);

      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            issues: parseResult.error.issues,
          },
          { status: 400 }
        );
      }

      const { title, description, version: requestVersion } = parseResult.data;

      // Check if ticket exists and get current version
      const currentTicket = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!currentTicket) {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        );
      }

      // Check for version conflict
      if (currentTicket.version !== requestVersion) {
        return NextResponse.json(
          {
            error: 'Conflict: Ticket was modified by another user',
            currentVersion: currentTicket.version,
          },
          { status: 409 }
        );
      }

      // Update ticket with version check
      try {
        const updatedTicket = await prisma.ticket.update({
          where: {
            id: ticketId,
            version: requestVersion,
          },
          data: {
            ...(title !== undefined && { title: title.trim() }),
            ...(description !== undefined && { description: description.trim() }),
            version: { increment: 1 },
          },
        });

        return NextResponse.json(
          {
            id: updatedTicket.id,
            title: updatedTicket.title,
            description: updatedTicket.description,
            stage: updatedTicket.stage,
            version: updatedTicket.version,
            createdAt: updatedTicket.createdAt.toISOString(),
            updatedAt: updatedTicket.updatedAt.toISOString(),
          },
          { status: 200 }
        );
      } catch (updateError) {
        // Handle version mismatch (P2025 error)
        if (updateError instanceof Error && 'code' in updateError) {
          const prismaError = updateError as { code: string };
          if (prismaError.code === 'P2025') {
            // Re-fetch to get current version
            const latestTicket = await prisma.ticket.findUnique({
              where: { id: ticketId },
            });
            return NextResponse.json(
              {
                error: 'Conflict: Ticket was modified by another user',
                currentVersion: latestTicket?.version || 0,
              },
              { status: 409 }
            );
          }
        }
        throw updateError;
      }
    }

    // Handle stage update (existing logic)
    if (isStageUpdate) {
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
    }

    // If neither stage nor inline edit, return error
    return NextResponse.json(
      {
        error: 'Invalid request',
        message: 'Must provide either stage or title/description to update',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating ticket:', error);

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
