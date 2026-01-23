'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Key, Plus, Trash2, Copy, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Token {
  id: number;
  name: string;
  tokenPreview: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function TokensPage() {
  const { status } = useSession();
  const router = useRouter();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create token modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [creating, setCreating] = useState(false);

  // Token display modal state (after creation)
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Delete confirmation state
  const [deleteTokenId, setDeleteTokenId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTokens = useCallback(async () => {
    try {
      const response = await fetch('/api/tokens');
      if (!response.ok) {
        throw new Error('Failed to fetch tokens');
      }
      const data = await response.json();
      setTokens(data.tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tokens');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (status === 'authenticated') {
      fetchTokens();
    }
  }, [status, router, fetchTokens]);

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create token');
      }

      const data = await response.json();
      setCreatedToken(data.token);
      setCreateModalOpen(false);
      setNewTokenName('');
      fetchTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteToken = async () => {
    if (deleteTokenId === null) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/tokens/${deleteTokenId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete token');
      }

      setTokens(tokens.filter((t) => t.id !== deleteTokenId));
      setDeleteTokenId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete token');
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = async () => {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#1e1e2e] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B5CF6]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1e1e2e] text-[hsl(var(--ctp-text))]">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Key className="w-6 h-6" />
              Personal Access Tokens
            </h1>
            <p className="text-[hsl(var(--ctp-subtext0))] mt-1">
              Manage tokens for API access from CLI tools, MCP servers, and integrations
            </p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Generate New Token
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-red-400 hover:text-red-300"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {tokens.length === 0 ? (
          <Card className="bg-[#313244] border-[hsl(var(--ctp-surface1))]">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Key className="w-12 h-12 text-[hsl(var(--ctp-subtext0))] mb-4" />
              <h3 className="text-lg font-medium mb-2">No tokens yet</h3>
              <p className="text-[hsl(var(--ctp-subtext0))] text-center max-w-md mb-4">
                Generate a personal access token to connect external tools like CLI applications,
                MCP servers, or CI/CD pipelines to your AI-BOARD account.
              </p>
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Generate Your First Token
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {tokens.map((token) => (
              <Card key={token.id} className="bg-[#313244] border-[hsl(var(--ctp-surface1))]">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{token.name}</CardTitle>
                      <CardDescription className="font-mono text-sm">
                        {token.tokenPreview}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      onClick={() => setDeleteTokenId(token.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-6 text-sm text-[hsl(var(--ctp-subtext0))]">
                    <span>Created: {formatDate(token.createdAt)}</span>
                    <span>
                      Last used: {token.lastUsedAt ? formatDate(token.lastUsedAt) : 'Never'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Token Modal */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="bg-[#313244] border-[hsl(var(--ctp-surface1))]">
            <DialogHeader>
              <DialogTitle>Generate New Token</DialogTitle>
              <DialogDescription>
                Give your token a name to help you identify it later.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="e.g., My MCP, CI Pipeline, Development CLI"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateToken();
                }}
                className="bg-[#1e1e2e] border-[hsl(var(--ctp-surface1))]"
                maxLength={100}
              />
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setCreateModalOpen(false);
                  setNewTokenName('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateToken}
                disabled={!newTokenName.trim() || creating}
              >
                {creating ? 'Generating...' : 'Generate Token'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Token Display Modal (after creation) */}
        <Dialog
          open={!!createdToken}
          onOpenChange={(open) => {
            if (!open) {
              setCreatedToken(null);
              setCopied(false);
            }
          }}
        >
          <DialogContent className="bg-[#313244] border-[hsl(var(--ctp-surface1))]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                Token Generated
              </DialogTitle>
              <DialogDescription>
                Make sure to copy your personal access token now. You won&apos;t be able to see it
                again!
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-[#1e1e2e] rounded-md font-mono text-sm break-all">
                  {createdToken}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="mt-3 text-sm text-amber-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                This token will not be shown again
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  setCreatedToken(null);
                  setCopied(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <AlertDialog
          open={deleteTokenId !== null}
          onOpenChange={(open) => !open && setDeleteTokenId(null)}
        >
          <AlertDialogContent className="bg-[#313244] border-[hsl(var(--ctp-surface1))]">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Token</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this token? Any applications using this token will
                no longer be able to access the API.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteToken}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? 'Deleting...' : 'Delete Token'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
