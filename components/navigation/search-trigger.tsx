'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchTriggerProps {
  onClick: () => void;
}

export function SearchTrigger({ onClick }: SearchTriggerProps) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detects platform on mount, not cascading
    setIsMac(
      typeof navigator !== 'undefined' &&
        (navigator.platform?.toUpperCase().includes('MAC') ||
          navigator.userAgent?.toUpperCase().includes('MAC'))
    );
  }, []);

  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="hidden md:inline-flex items-center gap-2 text-muted-foreground w-64 justify-start"
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">Search...</span>
      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        {isMac ? '⌘' : 'Ctrl+'}K
      </kbd>
    </Button>
  );
}
