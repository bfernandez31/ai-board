import { signIn } from "@/app/api/auth/[...nextauth]/route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Github } from "lucide-react"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const params = await searchParams
  const callbackUrl = params.callbackUrl || "/projects"

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to AI Board</CardTitle>
          <CardDescription>
            Sign in with your GitHub account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  )
}
