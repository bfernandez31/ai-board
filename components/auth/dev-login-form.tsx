"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DevLoginFormProps {
  callbackUrl: string
}

export function DevLoginForm({ callbackUrl }: DevLoginFormProps) {
  const [email, setEmail] = useState("")
  const [secret, setSecret] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await signIn("dev-login", {
        email,
        secret,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid email or secret")
      } else if (result?.ok) {
        window.location.href = callbackUrl
      }
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Dev Login</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="dev-email">Email</Label>
          <Input
            id="dev-email"
            type="email"
            placeholder="dev@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dev-secret">Secret</Label>
          <Input
            id="dev-secret"
            type="password"
            placeholder="Enter dev login secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            required
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}
        <Button type="submit" variant="outline" className="w-full" size="lg" disabled={loading}>
          {loading ? "Signing in..." : "Sign in with Dev Login"}
        </Button>
      </form>
    </div>
  )
}
