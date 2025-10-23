import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAIBoardAvailability } from '@/app/lib/utils/ai-board-availability';

/**
 * Schema for route parameters
 */
const RouteParamsSchema = z.object({
  id: z.string().regex(/^\d+$/),
});

/**
 * GET /api/tickets/[id]/ai-board-availability
 * Check if AI-BOARD can be mentioned for the given ticket
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { id: ticketIdString } = params;

    // Validate route params
    const paramsResult = RouteParamsSchema.safeParse({
      id: ticketIdString,
    });

    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'Invalid ticket ID' },
        { status: 400 }
      );
    }

    const ticketId = parseInt(ticketIdString, 10);

    // Check AI-BOARD availability
    const availability = await checkAIBoardAvailability(ticketId);

    return NextResponse.json(availability);
  } catch (error) {
    console.error('Error checking AI-BOARD availability:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
