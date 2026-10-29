import { ProjectCard } from './project-card';
import { EmptyProjectsState } from './empty-projects-state';
import type { ProjectWithCount } from '@/app/lib/types/project';

interface ProjectsContainerProps {
  projects: ProjectWithCount[];
  canCreateProjects: boolean;
}

export function ProjectsContainer({ projects, canCreateProjects }: ProjectsContainerProps) {
  if (projects.length === 0) {
    return <EmptyProjectsState canCreateProjects={canCreateProjects} />;
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
