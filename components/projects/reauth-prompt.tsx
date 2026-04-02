'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { ShieldCheck, X } from 'lucide-react';

interface ReauthPromptProps {
  onDismiss: () => void;
}

export function ReauthPrompt({ onDismiss }: ReauthPromptProps) {
  const handleReauthorize = () => {
    signIn('github', { callbackUrl: window.location.href });
  };

  return (
    <div className="aurora-card p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="aurora-glow rounded-full p-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Additional GitHub Access Required
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        To import a repository, AI Board needs permission to read your GitHub
        repositories. This allows us to list your repos, check for existing
        configuration, and set up the project.
      </p>

      <div className="flex gap-3 pt-2">
        <Button onClick={handleReauthorize} className="aurora-glow">
          Authorize GitHub Access
        </Button>
        <Button variant="ghost" onClick={onDismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
