"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Trash2, CheckCircle, XCircle, Loader2, Eye, EyeOff } from "lucide-react";

type Provider = "ANTHROPIC" | "OPENAI";

interface ApiKeyEntry {
  id: number;
  provider: Provider;
  preview: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiKeysCardProps {
  project: {
    id: number;
  };
}

const PROVIDER_CONFIG: Record<
  Provider,
  { label: string; placeholder: string; prefix: string }
> = {
  ANTHROPIC: {
    label: "Anthropic (Claude)",
    placeholder: "sk-ant-...",
    prefix: "sk-ant-",
  },
  OPENAI: {
    label: "OpenAI (Codex)",
    placeholder: "sk-...",
    prefix: "sk-",
  },
};

function ApiKeyRow({
  provider,
  existing,
  projectId,
  onUpdate,
}: {
  provider: Provider;
  existing: ApiKeyEntry | null;
  projectId: number;
  onUpdate: () => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [validationState, setValidationState] = useState<
    "idle" | "validating" | "valid" | "invalid"
  >("idle");
  const [validationError, setValidationError] = useState("");

  const config = PROVIDER_CONFIG[provider];

  async function handleSave() {
    if (!inputValue.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/api-keys`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key: inputValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      setInputValue("");
      setShowInput(false);
      setValidationState("idle");
      onUpdate();
    } catch (error) {
      console.error("Error saving API key:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleValidate() {
    if (!inputValue.trim()) return;

    setValidationState("validating");
    setValidationError("");
    try {
      const response = await fetch(
        `/api/projects/${projectId}/api-keys/validate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, key: inputValue }),
        }
      );

      const data = await response.json();

      if (data.valid) {
        setValidationState("valid");
      } else {
        setValidationState("invalid");
        setValidationError(data.error || "Invalid key");
      }
    } catch {
      setValidationState("invalid");
      setValidationError("Failed to validate");
    }
  }

  async function handleDelete() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/api-keys`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      onUpdate();
    } catch (error) {
      console.error("Error deleting API key:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-accent p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{config.label}</span>
        </div>

        {existing && !showInput && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-mono">
              ****{existing.preview}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInput(true)}
            >
              Replace
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isLoading}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {!existing && !showInput && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInput(true)}
          >
            Configure
          </Button>
        )}
      </div>

      {showInput && (
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex gap-2">
            <ApiKeyInput
              value={inputValue}
              onChange={setInputValue}
              placeholder={config.placeholder}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!inputValue.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleValidate}
              disabled={
                !inputValue.trim() || validationState === "validating"
              }
            >
              {validationState === "validating" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              Test
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowInput(false);
                setInputValue("");
                setValidationState("idle");
              }}
            >
              Cancel
            </Button>

            {validationState === "valid" && (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <CheckCircle className="h-3.5 w-3.5" />
                Valid
              </span>
            )}
            {validationState === "invalid" && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <XCircle className="h-3.5 w-3.5" />
                {validationError}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ApiKeyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative flex-1">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        data-testid="api-key-input"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
        onClick={() => setVisible(!visible)}
        tabIndex={-1}
      >
        {visible ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

export function ApiKeysCard({ project }: ApiKeysCardProps) {
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/api-keys`);
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.apiKeys);
      }
    } catch (error) {
      console.error("Error fetching API keys:", error);
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const providers: Provider[] = ["ANTHROPIC", "OPENAI"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription>
          Provide your own API keys for AI agents. Keys are encrypted at rest
          and never exposed after saving.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3" data-testid="api-keys-list">
            {providers.map((provider) => (
              <ApiKeyRow
                key={provider}
                provider={provider}
                existing={
                  apiKeys.find((k) => k.provider === provider) ?? null
                }
                projectId={project.id}
                onUpdate={fetchKeys}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
