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

describe("sign-in error states", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("renders a generic inline retry message for dev-login failures", async () => {
    const { default: SignInPage } = await import("@/app/auth/signin/page")
    process.env.VERCEL_ENV = "preview"
    process.env.DEV_LOGIN_ENABLED = "true"
    process.env.DEV_LOGIN_SECRET = "shared-preview-secret"

    renderAsyncComponent(
      await SignInPage({
        searchParams: createSignInSearchParams({
          error: "dev-login",
        }),
      }),
    )

    expect(screen.getByText(/sign-in failed\. check your email and shared secret\./i)).toBeInTheDocument()
  })

  it("maps dev-login errors on the auth error page to the same generic message", async () => {
    const { default: AuthErrorPage } = await import("@/app/auth/error/page")
    renderAsyncComponent(
      await AuthErrorPage({
        searchParams: Promise.resolve({
          error: "dev-login",
        }),
      }),
    )

    expect(screen.getByText(/sign-in failed\. check your email and shared secret\./i)).toBeInTheDocument()
  })
})
