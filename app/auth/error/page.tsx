import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AuthErrorPageSearchParams {
  error?: string;
}

interface AuthErrorPageProps {
  searchParams: Promise<AuthErrorPageSearchParams>;
}

const authErrorMessages: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'You do not have permission to sign in.',
  Verification: 'The verification token has expired or has already been used.',
  'dev-login': 'Sign-in failed. Check your email and shared secret.',
  Default: 'An error occurred during authentication.',
};
const defaultAuthErrorMessage = 'An error occurred during authentication.';

function getAuthErrorMessage(error?: string): string {
  if (!error) {
    return defaultAuthErrorMessage;
  }

  return authErrorMessages[error] ?? defaultAuthErrorMessage;
}

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps): Promise<JSX.Element> {
  const params = await searchParams;
  const errorMessage = getAuthErrorMessage(params.error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Authentication Error</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full" size="lg">
            <Link href="/auth/signin">Try Again</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
