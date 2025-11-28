'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Error state component for the analytics dashboard
 * Displays when analytics data fails to load with a retry option
 */
export function ErrorState({ error }: { error: Error | string }) {
  const errorMessage = typeof error === 'string' ? error : error.message;

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Failed to Load Analytics</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {errorMessage || 'An unexpected error occurred while loading analytics data.'}
              </p>
            </div>
            <Button onClick={handleRetry} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
