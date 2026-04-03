'use client';

import Image from 'next/image';
import { Lock, Globe, AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface RepoPickerItemData {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  ownerAvatar: string;
  description: string | null;
  isPrivate: boolean;
  pushedAt: string | null;
  hasAdminAccess: boolean;
  isAlreadyImported: boolean;
  existingProjectId?: number | null;
}

interface RepoPickerItemProps {
  repo: RepoPickerItemData;
  onSelect: (repo: RepoPickerItemData) => void;
}

function formatPushedAt(pushedAt: string | null): string {
  if (!pushedAt) return 'Never pushed';
  const date = new Date(pushedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Updated today';
  if (diffDays === 1) return 'Updated yesterday';
  if (diffDays < 30) return `Updated ${diffDays} days ago`;
  if (diffDays < 365) return `Updated ${Math.floor(diffDays / 30)} months ago`;
  return `Updated ${Math.floor(diffDays / 365)} years ago`;
}

export function RepoPickerItem({ repo, onSelect }: RepoPickerItemProps) {
  const isDisabled = repo.isAlreadyImported || !repo.hasAdminAccess;

  let disabledReason: string | undefined;
  if (repo.isAlreadyImported) {
    disabledReason = 'This repository is already linked to a project';
  } else if (!repo.hasAdminAccess) {
    disabledReason = 'You need admin access to import this repository';
  }

  const handleClick = () => {
    if (!isDisabled) {
      onSelect(repo);
    }
  };

  const content = (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={`w-full text-left px-4 py-3 flex items-center gap-3 rounded-lg border transition-colors ${
        isDisabled
          ? 'opacity-50 cursor-not-allowed border-border bg-muted/30'
          : 'border-border hover:border-primary/50 hover:bg-accent/50 cursor-pointer'
      }`}
    >
      {/* Owner avatar */}
      <Image
        src={repo.ownerAvatar}
        alt={repo.owner}
        width={32}
        height={32}
        className="rounded-full flex-shrink-0"
      />

      {/* Repo info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">
            {repo.fullName}
          </span>
          {repo.isPrivate ? (
            <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          ) : (
            <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          )}
          {isDisabled && (
            <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
          )}
        </div>
        {repo.description && (
          <p className="text-sm text-muted-foreground truncate">
            {repo.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatPushedAt(repo.pushedAt)}
        </p>
      </div>
    </button>
  );

  if (isDisabled && disabledReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>
            <p>{disabledReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}
