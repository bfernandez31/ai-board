'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS = [
  { key: 'N', action: 'Create new ticket' },
  { key: 'S / /', action: 'Focus search' },
  { key: '1 - 6', action: 'Jump to column' },
  { key: '?', action: 'Toggle this help' },
  { key: 'Esc', action: 'Close modal / overlay' },
] as const;

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          {SHORTCUTS.map(({ key, action }) => (
            <div key={key} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">{action}</span>
              <div className="flex gap-1">
                {key.split(' / ').map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex h-7 min-w-7 items-center justify-center rounded border border-border bg-muted px-2 text-xs font-medium text-muted-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
