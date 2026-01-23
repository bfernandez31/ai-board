'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Key } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateTokenDialog } from './create-token-dialog';
import { RevokeTokenDialog } from './revoke-token-dialog';

interface Token {
  id: number;
  name: string;
  tokenPreview: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function TokenListCard() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [tokenToRevoke, setTokenToRevoke] = useState<Token | null>(null);

  const fetchTokens = useCallback(async () => {
    try {
      const response = await fetch('/api/tokens');
      if (response.ok) {
        const data = await response.json();
        setTokens(data.tokens);
      }
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  function handleRevokeClick(token: Token) {
    setTokenToRevoke(token);
    setRevokeDialogOpen(true);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Your Tokens</CardTitle>
            <CardDescription>
              Manage your personal access tokens for API authentication
            </CardDescription>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Generate Token
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading tokens...
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">
                No tokens yet. Generate a token to authenticate external tools.
              </p>
              <Button onClick={() => setCreateDialogOpen(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Generate Your First Token
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{token.name}</span>
                      <code className="text-xs px-2 py-0.5 bg-muted rounded">
                        ...{token.tokenPreview}
                      </code>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created {formatDate(token.createdAt)}
                      {token.lastUsedAt && (
                        <span> &middot; Last used {formatDate(token.lastUsedAt)}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRevokeClick(token)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {tokens.length >= 10 && (
                <p className="text-sm text-muted-foreground text-center">
                  Maximum limit of 10 tokens reached. Delete a token to create a new one.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTokenDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onTokenCreated={fetchTokens}
      />

      {tokenToRevoke && (
        <RevokeTokenDialog
          open={revokeDialogOpen}
          onOpenChange={setRevokeDialogOpen}
          tokenId={tokenToRevoke.id}
          tokenName={tokenToRevoke.name}
          onTokenRevoked={fetchTokens}
        />
      )}
    </>
  );
}
