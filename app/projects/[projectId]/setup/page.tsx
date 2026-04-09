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
      githubOwner: true,
      githubRepo: true,
      setupJobs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          projectId: true,
          agent: true,
          status: true,
          workflowRunId: true,
          partial: true,
          commitSha: true,
          errorCode: true,
          errorMessage: true,
          logs: true,
          artifactSummary: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  // If already configured, redirect to board
  if (project.configSyncedAt) {
    redirect(`/projects/${projectId}/board`);
  }

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

  const configSyncedAt = (project.configSyncedAt as Date | null)?.toISOString() ?? null;

  return (
    <main className="container mx-auto py-10 max-w-2xl">
      <SetupPageClient
        projectId={projectId}
        projectName={project.name}
        initialSetupState={{
          job: project.setupJobs[0]
            ? {
                ...project.setupJobs[0],
                workflowRunId: project.setupJobs[0].workflowRunId ? Number(project.setupJobs[0].workflowRunId) : null,
                artifactSummary: project.setupJobs[0].artifactSummary as {
                  created: Array<{ path: string; kind: string; reason?: string }>;
                  preserved: Array<{ path: string; kind: string; reason?: string }>;
                  missing: Array<{ path: string; kind: string; reason?: string }>;
                  analysisPath?: string;
                  partialReason?: string;
                } | null,
                startedAt: project.setupJobs[0].startedAt?.toISOString() ?? null,
                completedAt: project.setupJobs[0].completedAt?.toISOString() ?? null,
                createdAt: project.setupJobs[0].createdAt.toISOString(),
              }
            : null,
          configSyncedAt,
        }}
      />
    </main>
  );
}
