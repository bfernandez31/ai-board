'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface UpgradePromptProps {
  title: string;
  description: string;
}

export function UpgradePrompt({ title, description }: UpgradePromptProps) {
  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-amber-900 dark:text-amber-200">{title}</CardTitle>
        <CardDescription className="text-amber-800 dark:text-amber-300/90">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild size="sm">
          <Link href="/settings/billing">
            Upgrade Plan
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
