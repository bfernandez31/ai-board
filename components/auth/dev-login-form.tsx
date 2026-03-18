"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface DevLoginFormProps {
  callbackUrl: string;
}

export function DevLoginForm({ callbackUrl }: DevLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = email.trim() !== "" && secret.trim() !== "" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !secret.trim()) {
      setError("Email and secret are required");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        secret,
        redirect: false,
      });

      if (result?.ok) {
        router.push(callbackUrl);
      } else {
        setError("Invalid credentials");
      }
    } catch {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative flex items-center justify-center py-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <span className="relative bg-card px-2 text-xs text-muted-foreground uppercase">
          or dev login
        </span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dev-email">Email</Label>
        <Input
          id="dev-email"
          type="email"
          placeholder="dev@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dev-secret">Secret</Label>
        <Input
          id="dev-secret"
          type="password"
          placeholder="Dev login secret"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          required
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="outline"
        className="w-full"
        size="lg"
        disabled={!isValid || loading}
      >
        {loading ? "Signing in..." : "Sign in with Dev Login"}
      </Button>
    </form>
  );
}
