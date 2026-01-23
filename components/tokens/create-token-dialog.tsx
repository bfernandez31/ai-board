"use client";

import * as React from "react";
import { Copy, Check, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateTokenDialogProps {
  onCreateToken: (name: string) => Promise<{ token: string; preview: string } | undefined>;
  isCreating?: boolean;
}

export function CreateTokenDialog({
  onCreateToken,
  isCreating = false,
}: CreateTokenDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [generatedToken, setGeneratedToken] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Token name is required");
      return;
    }

    setError(null);
    const result = await onCreateToken(name.trim());

    if (result?.token) {
      setGeneratedToken(result.token);
    }
  };

  const handleCopy = async () => {
    if (generatedToken) {
      await navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state after animation
    setTimeout(() => {
      setName("");
      setGeneratedToken(null);
      setCopied(false);
      setError(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button>
          <Key className="mr-2 h-4 w-4" />
          Generate New Token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {generatedToken ? "Token Generated" : "Generate Personal Access Token"}
          </DialogTitle>
          <DialogDescription>
            {generatedToken
              ? "Copy your token now. You won't be able to see it again."
              : "Create a new token to authenticate API requests."}
          </DialogDescription>
        </DialogHeader>

        {!generatedToken ? (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="token-name">Token Name</Label>
                <Input
                  id="token-name"
                  placeholder="e.g., My MCP Server"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  maxLength={100}
                  disabled={isCreating}
                />
                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Give your token a descriptive name so you can identify it later.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isCreating}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
                {isCreating ? "Generating..." : "Generate Token"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Your Personal Access Token</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm break-all">
                    {generatedToken}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopy}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-amber-500">
                  Make sure to copy your token now. You won&apos;t be able to see it again!
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
