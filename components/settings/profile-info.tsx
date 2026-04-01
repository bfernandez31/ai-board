'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export interface ProfileData {
  name: string | null;
  email: string;
  image: string | null;
  createdAt: string;
  githubUsername: string | null;
  githubUrl: string | null;
  plan: 'FREE' | 'PRO' | 'TEAM';
}

interface ProfileInfoProps {
  profile: ProfileData;
}

export function ProfileInfo({ profile }: ProfileInfoProps) {
  const displayName = profile.name || profile.email;
  const initials = profile.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || '??';

  const formattedDate = new Date(profile.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const planLabels = { FREE: 'Free', PRO: 'Pro', TEAM: 'Team' } as const;
  const planLabel = planLabels[profile.plan];

  return (
    <div className="space-y-6">
      {/* Avatar and Name */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={profile.image || undefined} alt={displayName} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-lg font-semibold text-foreground" data-testid="profile-name">
            {displayName}
          </h2>
          <p className="text-sm text-muted-foreground" data-testid="profile-email">
            {profile.email}
          </p>
        </div>
      </div>

      {/* Profile Fields */}
      <div className="space-y-4">
        {/* GitHub Link */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">GitHub</span>
          {profile.githubUsername && profile.githubUrl ? (
            <a
              href={profile.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              data-testid="profile-github"
            >
              {profile.githubUsername}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-sm text-muted-foreground" data-testid="profile-github">
              Not available
            </span>
          )}
        </div>

        {/* Registration Date */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">Member since</span>
          <span className="text-sm text-foreground" data-testid="profile-date">
            {formattedDate}
          </span>
        </div>

        {/* Current Plan */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">Current plan</span>
          <div className="flex items-center gap-2" data-testid="profile-plan">
            <Badge variant="secondary">{planLabel}</Badge>
            <Link
              href="/settings/billing"
              className="text-sm text-primary hover:underline"
            >
              Manage billing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
