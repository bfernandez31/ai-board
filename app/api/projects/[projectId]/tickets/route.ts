import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  getTicketsByStage,
  getMoreShipTickets,
  listTicketsFiltered,
  countTicketsThisMonthForUser,
  projectExists,
} from '@/lib/db/tickets';
import { createTicketWithAttachments } from '@/lib/tickets/creation';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { CreateTicketSchema, ProjectIdSchema } from '@/lib/validations/ticket';
import { z, ZodError } from 'zod';
import formidable, { Fields, Files } from 'formidable';
import { Readable } from 'stream';
import { requireAuth } from '@/lib/db/users';
import { getUserSubscription } from '@/lib/billing/subscription';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdString } = await context.params;

    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json({ error: 'Invalid project ID', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const projectId = parseInt(projectIdString, 10);

    // Support workflow token auth (for health scan commands) alongside session auth
    const workflowAuth = validateWorkflowAuth(request);
    if (!workflowAuth.isValid) {
      await verifyProjectAccess(projectId, request);
    } else {
      if (!(await projectExists(projectId))) {
        return NextResponse.json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' }, { status: 404 });
      }
    }

    // Optional filters: ?stage=SHIP&workflowType=FULL&limit=50&offset=0&updatedSince=2025-01-01T00:00:00Z
    const { searchParams } = new URL(request.url);
    const ticketFiltersSchema = z.object({
      stage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP', 'CLOSED']).optional(),
      workflowType: z.enum(['FULL', 'QUICK', 'CLEAN']).optional(),
      limit: z.coerce.number().int().min(1).optional(),
      offset: z.coerce.number().int().min(0).optional(),
      updatedSince: z.string().datetime().optional(),
    });
    const filtersParsed = ticketFiltersSchema.safeParse({
      stage: searchParams.get('stage') || undefined,
      workflowType: searchParams.get('workflowType') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      updatedSince: searchParams.get('updatedSince') || undefined,
    });
    if (!filtersParsed.success) {
      return NextResponse.json({ error: 'Invalid filter parameters', code: 'VALIDATION_ERROR' }, { status: 400 });
    }
    const { stage: stageParam, workflowType: workflowTypeParam, limit: limitParam, offset: offsetParam, updatedSince } = filtersParsed.data;

    // SHIP "Load More" pagination: ?stage=SHIP&offset=50&limit=50
    if (stageParam === 'SHIP' && offsetParam !== undefined) {
      const tickets = await getMoreShipTickets(projectId, offsetParam, limitParam ?? 50);
      return NextResponse.json({ tickets }, { status: 200 });
    }

    // If filters provided, query directly for efficiency
    if (stageParam || workflowTypeParam || limitParam || updatedSince) {
      const filtered = await listTicketsFiltered(projectId, {
        ...(stageParam && { stage: stageParam }),
        ...(workflowTypeParam && { workflowType: workflowTypeParam }),
        ...(limitParam && { limit: limitParam }),
        ...(updatedSince && { updatedSince: new Date(updatedSince) }),
      });
      return NextResponse.json(filtered, { status: 200 });
    }

    // Default: return all tickets grouped by stage, with SHIP limited to 50
    const { ticketsByStage, shipTotal } = await getTicketsByStage(projectId);
    return NextResponse.json({ ...ticketsByStage, _shipTotal: shipTotal }, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'AUTH_ERROR' },
          { status: 401 }
        );
      }
      if (error.message === 'Project not found') {
        return NextResponse.json(
          { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
          { status: 404 }
        );
      }
    }

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

async function parseFormData(request: NextRequest): Promise<{ fields: Fields; files: Files }> {
  const form = formidable({
    maxFiles: 5, // Max 5 images per ticket
    maxFileSize: 10 * 1024 * 1024, // 10MB per file
    allowEmptyFiles: false,
    filter: (part) => {
      // Only allow image files
      return part.mimetype?.startsWith('image/') || false;
    },
  });

  // Convert NextRequest to Node.js IncomingMessage-like object
  const buffer = await request.arrayBuffer();

  const contentType = request.headers.get('content-type');

  const boundary = contentType?.match(/boundary=(.+)$/)?.[1];

  if (!boundary) {
    throw new Error('No boundary found in multipart/form-data request');
  }

  // Create a proper Node.js Readable stream
  const nodeStream = new Readable({
    read() {
      // Push the buffer data
      this.push(Buffer.from(buffer));
      // Signal end of stream
      this.push(null);
    },
  });

  // Add required properties for formidable (it expects IncomingMessage-like object)
  const formStream = nodeStream as Readable & { headers: Record<string, string>; method: string; url: string };
  formStream.headers = Object.fromEntries(request.headers.entries());
  formStream.method = request.method;
  formStream.url = request.url;

  return new Promise((resolve, reject) => {
    form.parse(formStream as unknown as import('http').IncomingMessage, (err, fields, files) => {
      if (err) {
        reject(err);
      } else {
        resolve({ fields, files });
      }
    });
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdString } = await context.params;

    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json({ error: 'Invalid project ID', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const projectId = parseInt(projectIdString, 10);

    // Support both workflow auth (Bearer WORKFLOW_API_TOKEN) and user auth (session/PAT)
    const workflowAuth = validateWorkflowAuth(request);
    const isWorkflowRequest = workflowAuth.isValid;

    if (!isWorkflowRequest) {
      await verifyProjectAccess(projectId, request);

      // Check plan limits for ticket creation (skip for workflow-created tickets)
      const userId = await requireAuth(request);
      const subscription = await getUserSubscription(userId);
      if (subscription.limits.maxTicketsPerMonth !== null) {
        const ticketCount = await countTicketsThisMonthForUser(userId);
        if (ticketCount >= subscription.limits.maxTicketsPerMonth) {
          return NextResponse.json(
            { error: `Monthly ticket limit reached. Your ${subscription.plan} plan allows ${subscription.limits.maxTicketsPerMonth} tickets per month. Upgrade for unlimited tickets.`, code: 'PLAN_LIMIT' },
            { status: 403 }
          );
        }
      }
    } else {
      // For workflow requests, verify the project exists
      if (!(await projectExists(projectId))) {
        return NextResponse.json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' }, { status: 404 });
      }
    }

    const contentType = request.headers.get('content-type') || '';
    let ticketData: { title: string; description: string; clarificationPolicy?: string; agent?: string };
    let uploadedFiles: formidable.File[] = [];

    if (contentType.includes('multipart/form-data')) {
      let fields, files;
      try {
        const parsed = await parseFormData(request);
        fields = parsed.fields;
        files = parsed.files;
      } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error) {
          if (error.code === 1015) {
            return NextResponse.json(
              {
                error: 'Maximum 5 images allowed per ticket',
                code: 'VALIDATION_ERROR',
              },
              { status: 400 }
            );
          }
          if (error.code === 1009) {
            return NextResponse.json(
              {
                error: 'Total file size exceeds 10MB limit',
                code: 'VALIDATION_ERROR',
              },
              { status: 400 }
            );
          }
        }
        throw error;
      }

      const title = Array.isArray(fields.title) ? fields.title[0] : fields.title;
      const description = Array.isArray(fields.description) ? fields.description[0] : fields.description;
      const clarificationPolicy = Array.isArray(fields.clarificationPolicy)
        ? fields.clarificationPolicy[0]
        : fields.clarificationPolicy;
      const agent = Array.isArray(fields.agent)
        ? fields.agent[0]
        : fields.agent;

      if (!title || !description) {
        return NextResponse.json(
          {
            error: 'Missing required fields: title and description',
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        );
      }

      ticketData = {
        title,
        description,
        ...(clarificationPolicy && { clarificationPolicy }),
        ...(agent && { agent }),
      };

      if (files.images) {
        uploadedFiles = Array.isArray(files.images) ? files.images : [files.images];
      }
    } else {
      const body = await request.json();
      ticketData = body;
    }

    const result = CreateTicketSchema.safeParse(ticketData);

    if (!result.success) {
      const flattened = result.error.flatten();

        const fieldErrorMessages = Object.entries(flattened.fieldErrors)
        .map(
          ([field, errors]) =>
            `${field}: ${(errors as string[] | undefined)?.join(', ') || 'error'}`
        )
        .join('; ');

      const errorMessage = fieldErrorMessages || 'Invalid input';

      return NextResponse.json(
        {
          error: errorMessage,
          code: 'VALIDATION_ERROR',
          details: {
            fieldErrors: flattened.fieldErrors,
            formErrors: flattened.formErrors,
          },
        },
        { status: 400 }
      );
    }

    const creation = await createTicketWithAttachments(projectId, result.data, uploadedFiles);

    if (!creation.ok) {
      return NextResponse.json(creation.error, { status: creation.status });
    }

    const finalTicket = creation.ticket;

    revalidatePath(`/projects/${projectId}/board`);

    return NextResponse.json(
      {
        id: finalTicket.id,
        ticketNumber: finalTicket.ticketNumber,
        ticketKey: finalTicket.ticketKey,
        title: finalTicket.title,
        description: finalTicket.description,
        stage: finalTicket.stage,
        version: finalTicket.version,
        projectId: finalTicket.projectId,
        branch: finalTicket.branch,
        autoMode: finalTicket.autoMode,
        agent: finalTicket.agent,
        attachments: finalTicket.attachments,
        createdAt: finalTicket.createdAt.toISOString(),
        updatedAt: finalTicket.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/projects/[projectId]/tickets:', error);
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_ERROR' }, { status: 401 });
      if (error.message === 'Project not found') return NextResponse.json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' }, { status: 404 });
      if (error.message.includes('No boundary found')) return NextResponse.json({ error: 'Invalid multipart/form-data request', code: 'VALIDATION_ERROR' }, { status: 400 });
    }
    if (error instanceof ZodError) {
      const flattened = error.flatten();

      const fieldErrorMessages = Object.entries(flattened.fieldErrors)
        .map(
          ([field, errors]) =>
            `${field}: ${(errors as string[] | undefined)?.join(', ') || 'error'}`
        )
        .join('; ');

      const errorMessage = fieldErrorMessages || 'Invalid input';

      return NextResponse.json(
        {
          error: errorMessage,
          code: 'VALIDATION_ERROR',
          details: {
            fieldErrors: flattened.fieldErrors,
            formErrors: flattened.formErrors,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to create ticket', code: 'DATABASE_ERROR' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
