'use client';

import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ProjectWithCount } from '@/app/lib/types/project';

interface ProjectCardProps {
  project: ProjectWithCount;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/projects/${project.id}/board`);
  };

  // Format timestamp
  const formattedDate = new Date(project.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card
      className="transition-transform duration-200 hover:scale-105 cursor-pointer"
      onClick={handleClick}
      data-testid="project-card"
      data-project-id={project.id}
    >
      <CardHeader>
        <CardTitle data-testid="project-name">{project.name}</CardTitle>
        <CardDescription data-testid="project-description">
          {project.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between text-sm text-gray-500">
          <span data-testid="project-updated">
            Last updated: {formattedDate}
          </span>
          <span data-testid="project-ticket-count">
            {project.ticketCount} {project.ticketCount === 1 ? 'ticket' : 'tickets'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
