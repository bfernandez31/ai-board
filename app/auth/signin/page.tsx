import { getDevLoginFailureRedirect, isDevLoginEnabled } from "@/app/lib/auth/dev-login"
import { signIn, AuthError } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Github } from "lucide-react"
import { SiGitlab, SiBitbucket } from "react-icons/si"
import Link from "next/link"
import { redirect } from "next/navigation"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  const params = await searchParams
  const callbackUrl = params.callbackUrl || "/projects"
  const error = params.error
  const devLoginEnabled = isDevLoginEnabled()

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md border-primary border-2">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to AI Board</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in with your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error === "dev-login" ? (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Sign-in failed. Check your email and shared secret.
            </p>
          ) : null}

          {devLoginEnabled ? (
            <form
              action={async (formData) => {
                "use server"

                try {
                  await signIn("credentials", {
                    email: String(formData.get("email") ?? ""),
                    secret: String(formData.get("secret") ?? ""),
                    redirectTo: callbackUrl,
                  })
                } catch (error) {
                  if (error instanceof AuthError) {
                    redirect(getDevLoginFailureRedirect(callbackUrl))
                  }

                  throw error
                }
              }}
              className="space-y-3 rounded-lg border border-border p-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
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
            <p className="text-xs text-muted-foreground text-center">
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
            <p className="text-xs text-muted-foreground text-center">
              Coming soon
            </p>
          </div>
          <p className="text-sm text-center text-muted-foreground">
            By signing in, you agree to our{' '}
            <Link href="/legal/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
