import { beforeEach, describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import {
  createSignInSearchParams,
  renderAsyncComponent,
} from "@/tests/unit/components/sign-in-page-test-helpers"

vi.mock("@/lib/auth", () => ({
  signIn: vi.fn(),
  AuthError: class AuthError extends Error {},
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe("sign-in page when dev login is disabled", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("renders only the GitHub path outside preview", async () => {
    const { default: SignInPage } = await import("@/app/auth/signin/page")
    process.env.VERCEL_ENV = "production"
    process.env.DEV_LOGIN_ENABLED = "false"
    process.env.DEV_LOGIN_SECRET = ""

    renderAsyncComponent(
      await SignInPage({
        searchParams: createSignInSearchParams(),
      }),
    )

    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/shared secret/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /continue with github/i })).toBeInTheDocument()
  })
})
