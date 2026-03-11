import { signIn } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Github } from "lucide-react"
import { SiGitlab, SiBitbucket } from "react-icons/si"
import Link from "next/link"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const params = await searchParams
  const callbackUrl = params.callbackUrl || "/projects"

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md border-[#8B5CF6] border-2">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to AI Board</CardTitle>
          <CardDescription className="text-[hsl(var(--ctp-subtext-0))]">
            Sign in with your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* GitHub OAuth - Active */}
          <form action={async () => {
            "use server"
            await signIn("github", {
              redirectTo: callbackUrl
            })
          }}>
            <Button type="submit" className="w-full" size="lg">
              <Github className="mr-2 h-5 w-5" />
              Continue with GitHub
            </Button>
          </form>

          {/* GitLab OAuth - Disabled */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="lg"
              disabled
              className="w-full opacity-50 cursor-not-allowed"
            >
              <SiGitlab className="mr-2 h-5 w-5" />
              Continue with GitLab
            </Button>
            <p className="text-xs text-[hsl(var(--ctp-subtext-0))] text-center">
              Coming soon
            </p>
          </div>

          {/* BitBucket OAuth - Disabled */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="lg"
              disabled
              className="w-full opacity-50 cursor-not-allowed"
            >
              <SiBitbucket className="mr-2 h-5 w-5" />
              Continue with BitBucket
            </Button>
            <p className="text-xs text-[hsl(var(--ctp-subtext-0))] text-center">
              Coming soon
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <p className="w-full text-center text-xs text-[hsl(var(--ctp-subtext-0))]">
            By signing in, you agree to our{' '}
            <Link href="/legal/terms" className="underline hover:text-white transition-colors">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy" className="underline hover:text-white transition-colors">
              Privacy Policy
            </Link>
            .
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
