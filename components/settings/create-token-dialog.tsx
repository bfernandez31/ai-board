'use client';

import { useState } from 'react';
import { Copy, Check, AlertTriangle } from 'lucide-react';
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
import { Label } from '@/components/ui/label';

interface CreateTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTokenCreated: () => void;
}

export function CreateTokenDialog({
  open,
  onOpenChange,
  onTokenCreated,
}: CreateTokenDialogProps) {
  const [name, setName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Token name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create token');
        return;
      }

      setToken(data.token);
      onTokenCreated();
    } catch {
      setError('Failed to create token. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopy() {
    if (!token) return;

    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = token;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleClose() {
    setName('');
    setToken(null);
    setCopied(false);
    setError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {token ? 'Token Created' : 'Generate New Token'}
          </DialogTitle>
          <DialogDescription>
            {token
              ? 'Copy your token now. You won\'t be able to see it again.'
              : 'Give your token a descriptive name to identify its purpose.'}
          </DialogDescription>
        </DialogHeader>

        {!token ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token-name">Token Name</Label>
              <Input
                id="token-name"
                placeholder="e.g., MCP Server, CLI Tool"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                disabled={isLoading}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-500">
                Make sure to copy your token now. You won&apos;t be able to see it again!
              </p>
            </div>

            <div className="space-y-2">
              <Label>Your Token</Label>
              <div className="flex gap-2">
                <code className="flex-1 p-3 bg-muted rounded-md text-sm font-mono break-all">
                  {token}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!token ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isLoading || !name.trim()}>
                {isLoading ? 'Creating...' : 'Generate Token'}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>
              {copied ? 'Done' : 'Close'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
