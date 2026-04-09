'use client';

import { useState, useCallback } from 'react';
import { Loader2, FileText, Clock } from 'lucide-react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { DEPTH_OPTIONS } from '@/lib/spec-generation/constants';
import type { SpecDepth } from '@prisma/client';

interface SpecGenModalProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const specGenFormSchema = z.object({
  depth: z.enum(['QUICK', 'STANDARD', 'COMPREHENSIVE']),
  documentationUrl: z.string().url().max(2000).optional().or(z.literal('')),
  additionalContext: z.string().max(5000).optional(),
});

export function SpecGenModal({ projectId, open, onOpenChange }: SpecGenModalProps) {
  const { toast } = useToast();
  const [selectedDepth, setSelectedDepth] = useState<SpecDepth>('STANDARD');
  const [documentationUrl, setDocumentationUrl] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);

    const validation = specGenFormSchema.safeParse({
      depth: selectedDepth,
      documentationUrl: documentationUrl || undefined,
      additionalContext: additionalContext || undefined,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message || 'Invalid input');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/spec-generation/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'CLAUDE',
          depth: selectedDepth,
          documentationUrl: documentationUrl || undefined,
          additionalContext: additionalContext || undefined,
        }),
      });

      if (response.ok) {
        onOpenChange(false);
        toast({
          title: 'Spec generation started',
          description: 'You can track progress in the board header.',
        });
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to start spec generation');
      }
    } catch {
      setError('Could not connect to the server.');
    } finally {
      setIsSubmitting(false);
    }
  }, [projectId, selectedDepth, documentationUrl, additionalContext, onOpenChange, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="aurora-glass sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Project Specs</DialogTitle>
          <DialogDescription>
            AI will analyze your codebase and generate specifications.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Depth Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Spec Depth</label>
            <div className="grid gap-2">
              {DEPTH_OPTIONS.map((option) => (
                <Card
                  key={option.value}
                  className={`cursor-pointer p-3 transition-all ${
                    selectedDepth === option.value
                      ? 'border-ctp-mauve ring-1 ring-ctp-mauve/30'
                      : 'hover:border-border/60'
                  }`}
                  onClick={() => setSelectedDepth(option.value)}
                  role="radio"
                  aria-checked={selectedDepth === option.value}
                  tabIndex={0}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        selectedDepth === option.value
                          ? 'border-ctp-mauve'
                          : 'border-muted-foreground/40'
                      }`}
                    >
                      {selectedDepth === option.value && (
                        <div className="h-2 w-2 rounded-full bg-ctp-mauve" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-foreground">{option.label}</p>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {option.time}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Documentation URL */}
          <div className="space-y-1.5">
            <label htmlFor="modal-doc-url" className="text-sm font-medium text-foreground">
              Documentation URL <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="modal-doc-url"
              type="url"
              placeholder="https://docs.example.com"
              value={documentationUrl}
              onChange={(e) => setDocumentationUrl(e.target.value)}
            />
          </div>

          {/* Additional Context */}
          <div className="space-y-1.5">
            <label htmlFor="modal-context" className="text-sm font-medium text-foreground">
              Additional Context <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="modal-context"
              placeholder="Any additional context about the project..."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={3}
            />
          </div>

          {/* Error display */}
          {error && (
            <p className="text-sm text-ctp-red">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            className="aurora-btn-mauve"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
