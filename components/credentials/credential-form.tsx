"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateCredential } from "@/lib/hooks/mutations/useCredentials";

type Provider = "ANTHROPIC" | "OPENAI";

export function CredentialForm() {
  const [provider, setProvider] = useState<Provider>("ANTHROPIC");
  const [credentialType, setCredentialType] = useState("API_KEY");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [formatError, setFormatError] = useState<string | null>(null);

  const createCredential = useCreateCredential();

  function validateFormat(prov: Provider, type: string, val: string): string | null {
    if (!val) return null;
    if (prov === "OPENAI") {
      if (type === "API_KEY") {
        if (!val.startsWith("sk-")) {
          return 'API key must start with "sk-"';
        }
        if (val.length < 20) {
          return "API key appears too short";
        }
      }
      // OAUTH_TOKEN: no format constraint
      return null;
    }
    // ANTHROPIC
    if (type === "API_KEY") {
      if (!val.startsWith("sk-ant-api")) {
        return 'API key must start with "sk-ant-api"';
      }
      if (val.length < 90) {
        return "API key appears too short";
      }
    } else if (type === "OAUTH_TOKEN") {
      if (val.length < 20) {
        return "OAuth token must be at least 20 characters";
      }
    }
    return null;
  }

  function handleValueChange(newValue: string) {
    setValue(newValue);
    setFormatError(validateFormat(provider, credentialType, newValue));
  }

  function handleTypeChange(newType: string) {
    setCredentialType(newType);
    setFormatError(validateFormat(provider, newType, value));
  }

  function getPlaceholder(prov: Provider, type: string): string {
    if (type === "OAUTH_TOKEN") {
      return prov === "OPENAI" ? "Paste your Codex token" : "Paste your OAuth token";
    }
    return prov === "OPENAI" ? "sk-proj-..." : "sk-ant-api03-...";
  }

  function handleProviderChange(newProvider: Provider) {
    setProvider(newProvider);
    setFormatError(validateFormat(newProvider, credentialType, value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const error = validateFormat(provider, credentialType, value);
    if (error) {
      setFormatError(error);
      return;
    }

    try {
      await createCredential.mutateAsync({
        provider,
        credentialType,
        label: label.trim(),
        value,
      });
      setLabel("");
      setValue("");
      setFormatError(null);
    } catch {
      // Error is available via createCredential.error
    }
  }

  function getPlaceholder(prov: Provider, type: string): string {
    if (type === "OAUTH_TOKEN") {
      return prov === "OPENAI" ? "Paste your Codex token" : "Paste your OAuth token";
    }
    return prov === "OPENAI" ? "sk-proj-..." : "sk-ant-api03-...";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger id="provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ANTHROPIC">Anthropic</SelectItem>
              <SelectItem value="OPENAI">OpenAI</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="credentialType">Credential Type</Label>
          <Select value={credentialType} onValueChange={handleTypeChange}>
            <SelectTrigger id="credentialType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="API_KEY">API Key</SelectItem>
              <SelectItem value="OAUTH_TOKEN">OAuth Token</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="label">Label</Label>
        <Input
          id="label"
          placeholder="e.g. Production API Key"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={100}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="value">
          {credentialType === "API_KEY" ? "API Key" : "OAuth Token"}
        </Label>
        <Input
          id="value"
          type="password"
          placeholder={getPlaceholder(provider, credentialType)}
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          required
        />
        {formatError && (
          <p className="text-sm text-destructive">{formatError}</p>
        )}
      </div>

      {createCredential.error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {createCredential.error.message}
        </div>
      )}

      <Button
        type="submit"
        disabled={createCredential.isPending || !label.trim() || !value || !!formatError}
      >
        {createCredential.isPending ? "Saving..." : "Save Credential"}
      </Button>
    </form>
  );
}
