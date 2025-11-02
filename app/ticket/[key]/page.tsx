import { redirect } from 'next/navigation';
import { getCurrentUserOrNull } from '@/lib/db/users';

/**
 * Ticket Browse Page - Clean URL Access
 *
 * This page handles ticket access via clean URLs like /ticket/ABC-123
 * It resolves the ticket key and redirects to the project board with the ticket modal open
 */
export default async function TicketBrowsePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const user = await getCurrentUserOrNull();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/api/auth/signin');
  }

  const { key } = await params;

  // Validate ticket key format
  const ticketKeyRegex = /^[A-Z0-9]{3,6}-\d+$/;
  if (!ticketKeyRegex.test(key)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1e1e2e]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#cdd6f4] mb-4">Invalid Ticket Key</h1>
          <p className="text-[#a6adc8]">
            Ticket key must be in format KEY-NUM (e.g., ABC-123)
          </p>
        </div>
      </div>
    );
  }

  // Fetch ticket to get project ID
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/ticket/${key}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      response.status === 404
        ? 'Ticket not found'
        : response.status === 403
        ? 'You do not have access to this ticket'
        : 'Failed to load ticket';

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1e1e2e]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#cdd6f4] mb-4">Error</h1>
          <p className="text-[#a6adc8]">{errorMessage}</p>
          {errorData.code && (
            <p className="text-xs text-[#6c7086] mt-2">Error Code: {errorData.code}</p>
          )}
        </div>
      </div>
    );
  }

  const ticket = await response.json();

  // Redirect to project board with ticket modal open
  // We use the ticket key as the modal identifier
  redirect(`/projects/${ticket.projectId}/board?ticket=${key}`);
}
