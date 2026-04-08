import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { requireAuth } from '@/lib/db/users';
import { SetupWizard } from '@/components/setup/setup-wizard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SetupPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId: projectIdString } = await params;
  const projectId = parseInt(projectIdString, 10);

  if (isNaN(projectId) || projectId <= 0) {
    notFound();
  }

  // Verify ownership
  const userId = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true, name: true, configSyncedAt: true },
  });

  if (!project) {
    notFound();
  }

  // Redirect to board if already configured
  if (project.configSyncedAt) {
    redirect(`/projects/${projectId}/board`);
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-black">
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="space-y-2 mb-8">
          <h1 className="text-2xl font-bold text-foreground">Set Up {project.name}</h1>
          <p className="text-sm text-muted-foreground">
            Choose an AI agent to detect your tech stack and generate project configuration files.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <SetupWizard projectId={projectId} />
        </div>
      </div>
    </main>
  );
}
