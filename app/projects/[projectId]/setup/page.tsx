import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { ProjectSetupPageClient } from '@/components/projects/setup/setup-page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProjectSetupPage({
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
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: {
      id: true,
      name: true,
      githubOwner: true,
      githubRepo: true,
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <main className="container mx-auto max-w-4xl py-10">
      <ProjectSetupPageClient
        projectId={project.id}
        projectName={project.name}
        repository={`${project.githubOwner}/${project.githubRepo}`}
      />
    </main>
  );
}
