import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/db/users';
import { resolveProjectSetupAccess } from '@/lib/onboarding/access';
import { ProjectLayoutShell } from '@/components/projects/project-layout-shell';

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ projectId: string }>;
  children: React.ReactNode;
}) {
  const userId = await requireAuth();
  const { projectId: projectIdValue } = await params;
  const projectId = Number(projectIdValue);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    notFound();
  }

  const access = await resolveProjectSetupAccess(projectId, userId);
  if (!access) {
    notFound();
  }

  if (access.requiresSetup) {
    if (!access.isOwner) {
      notFound();
    }
    if (access.redirectTo && access.redirectTo !== `/projects/${projectId}/setup`) {
      redirect(access.redirectTo);
    }
  }

  return <ProjectLayoutShell projectId={projectId}>{children}</ProjectLayoutShell>;
}
