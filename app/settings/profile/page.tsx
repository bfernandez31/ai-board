'use client';

import { useQuery } from '@tanstack/react-query';
import { User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DangerZone } from '@/components/settings/danger-zone';

interface ProfileData {
  name: string;
  email: string;
  image: string | null;
  githubUsername: string | null;
  githubProfileUrl: string | null;
  createdAt: string;
  plan: string;
}

async function fetchProfile(): Promise<ProfileData> {
  const res = await fetch('/api/settings/profile');
  if (!res.ok) {
    throw new Error('Failed to fetch profile');
  }
  return res.json();
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border aurora-bg-subtle p-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-32 bg-muted animate-pulse rounded" />
            <div className="h-4 w-48 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="h-4 w-24 bg-muted animate-pulse rounded mb-2" />
            <div className="h-5 w-40 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(isoDate));
}

export default function ProfileSettingsPage() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: fetchProfile,
  });

  const initials = profile?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || '??';

  return (
    <main className="container mx-auto py-10 max-w-4xl px-4 sm:px-6">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <UserIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
            <p className="text-sm text-muted-foreground">
              Your account information
            </p>
          </div>
        </div>

        {isLoading || !profile ? (
          <ProfileSkeleton />
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border aurora-bg-subtle p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile.image ?? undefined} alt={profile.name} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold">{profile.name}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground mb-1">Display Name</p>
                <p className="font-medium">{profile.name}</p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="font-medium">{profile.email}</p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground mb-1">GitHub Account</p>
                {profile.githubUsername && profile.githubProfileUrl ? (
                  <a
                    href={profile.githubProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {profile.githubUsername}
                  </a>
                ) : (
                  <p className="font-medium text-muted-foreground">Connected</p>
                )}
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground mb-1">Member Since</p>
                <p className="font-medium">{formatDate(profile.createdAt)}</p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
                <Link
                  href="/settings/billing"
                  className="font-medium text-primary hover:underline"
                >
                  {profile.plan}
                </Link>
              </div>
            </div>

            <div className="border-t pt-6">
              <DangerZone userEmail={profile.email} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
