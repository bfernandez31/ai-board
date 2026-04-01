'use client';

import { User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ProfileInfo, type ProfileData } from '@/components/settings/profile-info';

async function fetchProfile(): Promise<ProfileData> {
  const res = await fetch('/api/settings/profile');
  if (!res.ok) {
    throw new Error('Failed to load profile');
  }
  return res.json();
}

export default function ProfileSettingsPage() {
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: fetchProfile,
  });

  return (
    <main className="container mx-auto py-10 max-w-4xl">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
            <p className="text-sm text-muted-foreground">
              Your account information
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">Loading profile...</div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load profile. Please try again later.
          </div>
        ) : profile ? (
          <div className="rounded-lg border border-border bg-card p-6">
            <ProfileInfo profile={profile} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
