'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const SHORTCUTS = [
  { key: 'N', action: 'Open new ticket modal' },
  { key: 'S / /', action: 'Focus search input' },
  { key: '1-6', action: 'Scroll to column (INBOX=1 ... SHIP=6)' },
  { key: '?', action: 'Toggle this help overlay' },
  { key: 'Esc', action: 'Close any open modal/overlay' },
] as const;

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="keyboard-shortcuts-modal" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Quick actions for the board. Shortcuts are disabled when typing in inputs.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 text-left font-medium text-muted-foreground">Key</th>
                <th className="py-2 text-left font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map((shortcut) => (
                <tr key={shortcut.key} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-4">
                    <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                      {shortcut.key}
                    </kbd>
                  </td>
                  <td className="py-2.5 text-foreground">{shortcut.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
