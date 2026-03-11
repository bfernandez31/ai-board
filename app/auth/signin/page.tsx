import Link from 'next/link';
import { Github } from 'lucide-react';
import type { IconType } from 'react-icons';
import { SiBitbucket, SiGitlab } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { signIn } from '@/lib/auth';

type SignInSearchParams = {
  callbackUrl?: string;
};

type SignInPageProps = {
  searchParams?: Promise<SignInSearchParams> | SignInSearchParams;
};

type DisabledProvider = {
  id: string;
  label: string;
  Icon: IconType;
};

const disabledProviders: DisabledProvider[] = [
  { id: 'gitlab', label: 'GitLab', Icon: SiGitlab },
  { id: 'bitbucket', label: 'Bitbucket', Icon: SiBitbucket },
];

export default async function SignInPage({ searchParams }: SignInPageProps): Promise<JSX.Element> {
  const params = await Promise.resolve(searchParams ?? {});
  const callbackUrl = params.callbackUrl ?? '/projects';

  async function handleGithubSignIn(): Promise<void> {
    'use server';
    await signIn('github', { redirectTo: callbackUrl });
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md border-2 border-[#8B5CF6]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to AI Board</CardTitle>
          <CardDescription className="text-[hsl(var(--ctp-subtext-0))]">
            Sign in with your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={handleGithubSignIn}>
            <Button type="submit" size="lg" className="w-full">
              <Github className="mr-2 h-5 w-5" />
              Continue with GitHub
            </Button>
          </form>

          {disabledProviders.map(({ id, label, Icon }) => (
            <div key={id} className="space-y-2">
              <Button
                variant="outline"
                size="lg"
                disabled
                className="w-full cursor-not-allowed opacity-50"
              >
                <Icon className="mr-2 h-5 w-5" />
                Continue with {label}
              </Button>
              <p className="text-center text-xs text-[hsl(var(--ctp-subtext-0))]">
                Coming soon
              </p>
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <p className="w-full text-center text-xs text-[hsl(var(--ctp-subtext-0))]">
            By signing in, you agree to our{' '}
            <Link href="/legal/terms" className="transition-colors underline hover:text-white">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy" className="transition-colors underline hover:text-white">
              Privacy Policy
            </Link>
            .
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
