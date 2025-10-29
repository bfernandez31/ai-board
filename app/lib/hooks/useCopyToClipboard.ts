'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

/**
 * Custom hook for clipboard copy functionality with visual feedback
 * Uses native Clipboard API + shadcn/ui toast notifications
 */
export function useCopyToClipboard() {
  const { toast } = useToast();
  const [isCopied, setIsCopied] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);

      toast({
        title: 'Copied to clipboard',
        description: text,
      });

      // Reset after 2 seconds
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast({
        title: 'Failed to copy',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  return { copy, isCopied };
}
