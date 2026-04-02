'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeleteAccountDialog } from '@/components/settings/delete-account-dialog';

interface DangerZoneProps {
  userEmail: string;
}

export function DangerZone({ userEmail }: DangerZoneProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="rounded-lg border border-destructive/50 p-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => setDialogOpen(true)}>
          Delete my account
        </Button>
      </div>

      <DeleteAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        userEmail={userEmail}
      />
    </>
  );
}
