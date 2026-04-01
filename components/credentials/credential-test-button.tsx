"use client";

import { CheckCircle2, Loader2, AlertCircle, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTestCredential } from "@/lib/hooks/mutations/useCredentials";

interface CredentialTestButtonProps {
  credentialId: number;
}

function getTestState(testCredential: ReturnType<typeof useTestCredential>) {
  if (testCredential.isPending) {
    return {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      className: "text-muted-foreground",
      tooltip: "Testing...",
    };
  }

  if (testCredential.isSuccess && testCredential.data?.readinessStatus === "READY") {
    return {
      icon: <CheckCircle2 className="h-4 w-4" />,
      className: "text-green-600",
      tooltip: "Credential is valid",
    };
  }

  if (testCredential.isSuccess) {
    return {
      icon: <AlertCircle className="h-4 w-4" />,
      className: "text-destructive",
      tooltip: testCredential.data?.verificationMessage || "Credential validation failed",
    };
  }

  return {
    icon: <FlaskConical className="h-4 w-4" />,
    className: "text-muted-foreground",
    tooltip: testCredential.error?.message || "Test credential",
  };
}

export function CredentialTestButton({ credentialId }: CredentialTestButtonProps) {
  const testCredential = useTestCredential();
  const { icon, className, tooltip } = getTestState(testCredential);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => testCredential.mutate(credentialId)}
            disabled={testCredential.isPending}
            className={className}
          >
            {icon}
            <span className="sr-only">Test credential</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
