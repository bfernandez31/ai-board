'use client';

import { FileText } from 'lucide-react';

interface SetupFileListProps {
  files: string[];
  label?: string;
}

export function SetupFileList({ files, label }: SetupFileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      {label && (
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
      )}
      <div className="rounded-lg border border-border bg-card p-3">
        <ul className="space-y-1">
          {files.map((file) => (
            <li key={file} className="flex items-center gap-2 text-sm text-foreground">
              <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <code className="text-xs">{file}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
