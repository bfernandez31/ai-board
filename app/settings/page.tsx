'use client';

import Link from 'next/link';
import { Bot, CreditCard, Key } from 'lucide-react';
import { AiCredentialsCard } from '@/components/settings/ai-credentials-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <main className="container mx-auto max-w-4xl py-10">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage personal AI credentials, billing, and API access.
            </p>
          </div>
        </div>

        <AiCredentialsCard />

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/settings/billing" className="block">
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Billing
                </CardTitle>
                <CardDescription>Manage plan limits and your Stripe subscription.</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/settings/tokens" className="block">
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  API Tokens
                </CardTitle>
                <CardDescription>Create personal access tokens for scripts and tooling.</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        </div>
      </div>
    </main>
  );
}
