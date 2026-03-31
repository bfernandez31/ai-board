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

export function CredentialTestButton({ credentialId }: CredentialTestButtonProps) {
  const testCredential = useTestCredential();

  const handleTest = () => {
    testCredential.mutate(credentialId);
  };

  const isSuccess =
    testCredential.isSuccess &&
    testCredential.data?.readinessStatus === "READY";
  const isFailure =
    testCredential.isSuccess &&
    testCredential.data?.readinessStatus !== "READY";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleTest}
            disabled={testCredential.isPending}
            className={
              isSuccess
                ? "text-green-600"
                : isFailure
                  ? "text-destructive"
                  : "text-muted-foreground"
            }
          >
            {testCredential.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSuccess ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : isFailure ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <FlaskConical className="h-4 w-4" />
            )}
            <span className="sr-only">Test credential</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {testCredential.isPending
            ? "Testing..."
            : isSuccess
              ? "Credential is valid"
              : isFailure
                ? testCredential.data?.verificationMessage || "Credential validation failed"
                : testCredential.error
                  ? testCredential.error.message
                  : "Test credential"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
