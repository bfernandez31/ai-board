import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { requireAuth } from '@/lib/db/users';
import { SetupPageClient } from '@/components/setup/setup-page-client';

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

  const userId = await requireAuth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      userId: true,
      configSyncedAt: true,
      specsGeneratedAt: true,
      githubOwner: true,
      githubRepo: true,
    },
  });

  if (!project) {
    notFound();
  }

  // If fully configured (init + specs), redirect to board
  if (project.configSyncedAt && project.specsGeneratedAt) {
    redirect(`/projects/${projectId}/board`);
  }

  // Determine if Step 2 should be shown
  const showStep2 = !!project.configSyncedAt && !project.specsGeneratedAt;

  // Owner-only access
  if (project.userId !== userId) {
    return (
      <main className="container mx-auto py-10 max-w-2xl">
        <div className="aurora-bg-section rounded-lg border border-border p-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Access Denied</h1>
          <p className="text-muted-foreground mt-2">
            Only the project owner can configure this project.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto py-10 max-w-2xl">
      <SetupPageClient
        projectId={projectId}
        projectName={project.name}
        showStep2={showStep2}
      />
    </main>
  );
}
