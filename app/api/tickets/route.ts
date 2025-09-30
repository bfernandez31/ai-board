import { NextRequest, NextResponse } from 'next/server';
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
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input with Zod
    const validatedInput = CreateTicketSchema.parse(body);

    // Create ticket
    const ticket = await createTicket(validatedInput);

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
      const firstError = error.issues[0];
      return NextResponse.json(
        {
          error: firstError?.message ?? 'Validation failed',
          code: 'VALIDATION_ERROR',
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