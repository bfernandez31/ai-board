'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Copy, Check, Github } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils/format-timestamp';
import { useCopyToClipboard } from '@/app/lib/hooks/useCopyToClipboard';
import { ProjectMenu } from '@/components/project/ProjectMenu';
import type { ProjectWithCount } from '@/app/lib/types/project';

interface ProjectCardProps {
  project: ProjectWithCount;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const { copy, isCopied } = useCopyToClipboard();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering timestamp after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClick = () => {
    router.push(`/projects/${project.id}/board`);
  };

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card navigation
    if (project.deploymentUrl) {
      copy(project.deploymentUrl);
    }
  };

  const handleGitHubClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card navigation
  };

  return (
    <Card
      className="bg-[#181825] border-[#313244] transition-all duration-200 hover:border-[#45475a] hover:shadow-lg cursor-pointer will-change-transform hover:brightness-110"
      onClick={handleClick}
      data-testid="project-card"
      data-project-id={project.id}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[#cdd6f4]" data-testid="project-name">
            {project.name}
          </CardTitle>
          <div onClick={(e) => e.stopPropagation()}>
            <ProjectMenu projectId={project.id} />
          </div>
        </div>

        {/* GitHub Repository Link (User Story 3) */}
        <a
          href={`https://github.com/${project.githubOwner}/${project.githubRepo}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleGitHubClick}
          className="flex items-center gap-2 text-sm text-[#a6adc8] hover:text-[#cdd6f4] transition-colors w-fit"
          data-testid="github-link"
        >
          <Github className="h-4 w-4" />
          <span>{project.githubOwner}/{project.githubRepo}</span>
        </a>

        {/* Deployment URL (User Story 2) */}
        {project.deploymentUrl && (
          <div className="flex items-center gap-2" data-testid="deployment-section">
            <a
              href={project.deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-[#89b4fa] hover:text-[#b4befe] transition-colors truncate"
              data-testid="deployment-url"
            >
              {new URL(project.deploymentUrl).hostname}
            </a>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCopyUrl}
              className="h-8 w-8 text-[#a6adc8] hover:text-[#cdd6f4]"
              data-testid="copy-deployment-url"
            >
              {isCopied ? (
                <Check className="h-4 w-4" data-testid="check-icon" />
              ) : (
                <Copy className="h-4 w-4" data-testid="copy-icon" />
              )}
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Shipped Ticket Status (User Story 1) */}
        {project.lastShippedTicket ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <CheckCircle className="h-4 w-4 text-[#a6e3a1] flex-shrink-0" />
              <span
                className="text-[#cdd6f4] truncate min-w-0"
                data-testid="shipped-ticket-title"
                title={`${project.lastShippedTicket.ticketKey} ${project.lastShippedTicket.title}`}
              >
                <span className="font-semibold" data-testid="shipped-ticket-key">
                  {project.lastShippedTicket.ticketKey}
                </span>
                {' '}
                {project.lastShippedTicket.title}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm pl-6" data-testid="shipped-ticket-metadata">
              {mounted && (
                <span className="text-[#6c7086] whitespace-nowrap" data-testid="shipped-ticket-time">
                  Shipped {formatTimestamp(project.lastShippedTicket.updatedAt)}
                </span>
              )}
              <span className="text-[#6c7086] whitespace-nowrap" data-testid="ticket-count">
                · {project.ticketCount} total
              </span>
            </div>
          </div>
        ) : (
          <span className="text-sm text-[#6c7086]" data-testid="no-shipped-tickets">
            {project.ticketCount === 0
              ? 'No tickets yet'
              : `No tickets shipped yet · ${project.ticketCount} total`}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
