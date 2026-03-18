import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Github } from 'lucide-react';
import { SiBitbucket, SiGitlab } from 'react-icons/si';
import {
  getDevLoginFailureRedirect,
  isDevLoginEnabled,
} from '@/app/lib/auth/dev-login';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthError, signIn } from '@/lib/auth';

interface SignInPageSearchParams {
  callbackUrl?: string;
  error?: string;
}

interface SignInPageProps {
  searchParams: Promise<SignInPageSearchParams>;
}

async function signInWithPreviewLogin(
  formData: FormData,
  callbackUrl: string
): Promise<void> {
  'use server';

  try {
    await signIn('credentials', {
      email: String(formData.get('email') ?? ''),
      secret: String(formData.get('secret') ?? ''),
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(getDevLoginFailureRedirect(callbackUrl));
    }

    throw error;
  }
}

async function signInWithGitHub(callbackUrl: string): Promise<void> {
  'use server';

  await signIn('github', {
    redirectTo: callbackUrl,
  });
}

export default async function SignInPage({
  searchParams,
}: SignInPageProps): Promise<JSX.Element> {
  const disabledProviderClassName = 'w-full cursor-not-allowed opacity-50';
  const disabledProviderNoticeClassName =
    'text-center text-xs text-muted-foreground';
  const legalLinkClassName = 'text-primary hover:underline';
  const devLoginEnabled = isDevLoginEnabled();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || '/projects';
  const error = params.error;
  const showDevLoginError = error === 'dev-login';

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md border-2 border-primary">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to AI Board</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in with your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showDevLoginError ? (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Sign-in failed. Check your email and shared secret.
            </p>
          ) : null}

          {devLoginEnabled ? (
            <form
              action={async (formData) =>
                signInWithPreviewLogin(formData, callbackUrl)
              }
              className="space-y-3 rounded-lg border border-border p-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret">Shared secret</Label>
                <Input id="secret" name="secret" type="password" required />
              </div>
              <Button type="submit" className="w-full" size="lg">
                Continue with Preview Login
              </Button>
            </form>
          ) : null}

          <form action={async () => signInWithGitHub(callbackUrl)}>
            <Button type="submit" className="w-full" size="lg">
              <Github className="mr-2 h-5 w-5" />
              Continue with GitHub
            </Button>
          </form>

          <div className="space-y-2">
            <Button
              variant="outline"
              size="lg"
              disabled
              className={disabledProviderClassName}
            >
              <SiGitlab className="mr-2 h-5 w-5" />
              Continue with GitLab
            </Button>
            <p className={disabledProviderNoticeClassName}>Coming soon</p>
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              size="lg"
              disabled
              className={disabledProviderClassName}
            >
              <SiBitbucket className="mr-2 h-5 w-5" />
              Continue with BitBucket
            </Button>
            <p className={disabledProviderNoticeClassName}>Coming soon</p>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            By signing in, you agree to our{' '}
            <Link href="/legal/terms" className={legalLinkClassName}>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy" className={legalLinkClassName}>
              Privacy Policy
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
