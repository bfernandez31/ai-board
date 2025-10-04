import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/client';

/**
 * Root Page
 * Redirects to the first available project board
 */
export default async function Home() {
  // Find the first project, or create a default one if none exists
  let project = await prisma.project.findFirst({
    orderBy: { id: 'asc' }
  });

  if (!project) {
    // Create default project if none exists
    project = await prisma.project.create({
      data: {
        name: 'ai-board',
        description: 'AI-powered project management board',
        githubOwner: process.env.GITHUB_OWNER || 'default',
        githubRepo: process.env.GITHUB_REPO || 'default',
      },
    });
  }

  redirect(`/projects/${project.id}/board`);
}