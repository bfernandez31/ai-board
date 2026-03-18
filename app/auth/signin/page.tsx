import { DEV_LOGIN_PROVIDER_ID, getDevLoginErrorMessage, isDevLoginEnabled } from "@/app/lib/auth/dev-login"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn } from "@/lib/auth"
import { Github } from "lucide-react"
import Link from "next/link"
import type { ComponentType } from "react"
import { SiBitbucket, SiGitlab } from "react-icons/si"

type SignInPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}

type DisabledProviderButtonProps = {
  icon: ComponentType<{ className?: string }>
  name: string
}

function DisabledProviderButton({ icon: Icon, name }: DisabledProviderButtonProps) {
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="lg"
        disabled
        className="w-full cursor-not-allowed opacity-50"
      >
        <Icon className="mr-2 h-5 w-5" />
        Continue with {name}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Coming soon</p>
    </div>
  )
}

export default async function SignInPage({
  searchParams,
}: SignInPageProps) {
  const params = await searchParams
  const callbackUrl = params.callbackUrl || "/projects"
  const devLoginEnabled = isDevLoginEnabled()
  const devLoginError = getDevLoginErrorMessage(params.error)

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md border-primary border-2">
        <CardHeader className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to AI Board</h1>
          <CardDescription className="text-muted-foreground">
            Sign in with your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {devLoginError ? (
            <Alert variant="destructive">
              <AlertDescription>{devLoginError}</AlertDescription>
            </Alert>
          ) : null}

          <form
            action={async () => {
              "use server"
              await signIn("github", {
                redirectTo: callbackUrl,
              })
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              <Github className="mr-2 h-5 w-5" />
              Continue with GitHub
            </Button>
          </form>

          {devLoginEnabled ? (
            <div className="space-y-4 rounded-lg border border-border bg-background p-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Dev Login</h2>
                <p className="text-sm text-muted-foreground">
                  Use the shared preview secret to sign in without GitHub OAuth.
                </p>
              </div>

              <form
                className="space-y-4"
                action={async (formData) => {
                  "use server"
                  await signIn(DEV_LOGIN_PROVIDER_ID, {
                    email: formData.get("email"),
                    secret: formData.get("secret"),
                    redirectTo: callbackUrl
                  })
                }}
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
                  <Label htmlFor="secret">Shared Secret</Label>
                  <Input
                    id="secret"
                    name="secret"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" size="lg">
                  Sign in with Dev Login
                </Button>
              </form>
            </div>
          ) : null}

          <DisabledProviderButton icon={SiGitlab} name="GitLab" />
          <DisabledProviderButton icon={SiBitbucket} name="BitBucket" />

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
