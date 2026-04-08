import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/db/users';
import { resolveProjectSetupAccess } from '@/lib/onboarding/access';

export default async function ProjectEntryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId: projectIdValue } = await params;
  const projectId = Number(projectIdValue);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    notFound();
  }

  const userId = await requireAuth();
  const resolution = await resolveProjectSetupAccess(projectId, userId);

  if (!resolution) {
    notFound();
  }

  redirect(resolution.redirectTo ?? `/projects/${projectId}/board`);
}
