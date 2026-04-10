'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, FileSearch } from 'lucide-react';

type Depth = 'QUICK' | 'STANDARD' | 'COMPREHENSIVE';

const DEPTH_OPTIONS: { value: Depth; label: string; description: string; estimate: string }[] = [
  { value: 'QUICK', label: 'Quick', description: 'Project overview and high-level architecture', estimate: '~5 min' },
  { value: 'STANDARD', label: 'Standard', description: 'Architecture, APIs, data model, and workflows', estimate: '~15 min' },
  { value: 'COMPREHENSIVE', label: 'Comprehensive', description: 'Full functional and technical specifications', estimate: '~40 min' },
];

interface RetroSpecModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  defaultAgent?: import('@prisma/client').Agent | undefined;
  onSuccess?: (() => void) | undefined;
}

export function RetroSpecModal({ open, onOpenChange, projectId, defaultAgent = 'CLAUDE', onSuccess }: RetroSpecModalProps) {
  const [depth, setDepth] = useState<Depth>('STANDARD');
  const [docUrl, setDocUrl] = useState('');
  const [context, setContext] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docUrlError, setDocUrlError] = useState<string | null>(null);

  const validateDocUrl = (url: string): boolean => {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setDocUrlError(null);

    if (docUrl && !validateDocUrl(docUrl)) {
      setDocUrlError('Please enter a valid URL');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/setup/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: defaultAgent,
          command: 'RETRO_SPEC',
          depth,
          ...(docUrl && { docUrl }),
          ...(context && { context }),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to start spec generation');
        return;
      }

      onOpenChange(false);
      onSuccess?.();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null);
      setDocUrlError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            Generate Project Specs
          </DialogTitle>
          <DialogDescription>
            Analyze your codebase and generate specifications to improve health scans, ticket workflows, and code reviews.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Depth Selection */}
          <div className="space-y-2">
            <Label>Analysis Depth</Label>
            <div className="space-y-2" role="radiogroup" aria-label="Analysis depth">
              {DEPTH_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                    depth === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="depth"
                    value={option.value}
                    checked={depth === option.value}
                    onChange={() => setDepth(option.value)}
                    className="mt-1 accent-primary"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.estimate}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Documentation URL */}
          <div className="space-y-1.5">
            <Label htmlFor="retro-spec-doc-url">Documentation URL (optional)</Label>
            <Input
              id="retro-spec-doc-url"
              type="url"
              placeholder="https://docs.example.com"
              value={docUrl}
              onChange={(e) => {
                setDocUrl(e.target.value);
                setDocUrlError(null);
              }}
            />
            {docUrlError && (
              <p className="text-xs text-destructive">{docUrlError}</p>
            )}
          </div>

          {/* Additional Context */}
          <div className="space-y-1.5">
            <Label htmlFor="retro-spec-context">Additional Context (optional)</Label>
            <Textarea
              id="retro-spec-context"
              placeholder="Any context about the project that might help generate better specs..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
            />
          </div>

          {/* Error display */}
          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              'Generate Specs'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
