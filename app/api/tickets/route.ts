import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getTicketsByStage, createTicket } from '@/lib/db/tickets';
import { CreateTicketSchema } from '@/lib/validations/ticket';
import { ZodError } from 'zod';

/**
 * GET /api/tickets
 * Returns all tickets grouped by stage
 */
export async function GET() {
  try {
    const ticketsByStage = await getTicketsByStage();
    return NextResponse.json(ticketsByStage, { status: 200 });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tickets',
        code: 'DATABASE_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tickets
 * Creates a new ticket in the IDLE stage
 *
 * Timeout: 15 seconds (default Next.js API route timeout)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input with Zod
    const validatedInput = CreateTicketSchema.parse(body);

    // Create ticket
    const ticket = await createTicket(validatedInput);

    // Revalidate the board page to show new ticket
    revalidatePath('/board');

    // Return created ticket with 201 status
    return NextResponse.json(
      {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        stage: ticket.stage,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const flattened = error.flatten();
      return NextResponse.json(
        {
          error: 'Invalid input',
          code: 'VALIDATION_ERROR',
          details: {
            fieldErrors: flattened.fieldErrors,
            formErrors: flattened.formErrors,
          },
        },
        { status: 400 }
      );
    }

    // Handle database errors
    console.error('Error creating ticket:', error);
    return NextResponse.json(
      {
        error: 'Failed to create ticket',
        code: 'DATABASE_ERROR',
      },
      { status: 500 }
    );
  }
}