"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KeyRound } from "lucide-react"

export function DevLoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState("")
  const [secret, setSecret] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await signIn("dev-login", {
      email,
      secret,
      redirect: false,
      callbackUrl,
    })

    if (result?.error) {
      setError("Invalid email or secret")
      setLoading(false)
    } else if (result?.url) {
      window.location.href = result.url
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-muted-foreground/20" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Dev Login</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dev-email">Email</Label>
        <Input
          id="dev-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dev-secret">Secret</Label>
        <Input
          id="dev-secret"
          type="password"
          placeholder="Preview environment secret"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          required
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" variant="outline" className="w-full" size="lg" disabled={loading}>
        <KeyRound className="mr-2 h-5 w-5" />
        {loading ? "Signing in..." : "Sign in with Dev Login"}
      </Button>
    </form>
  )
}
