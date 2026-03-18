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

describe("sign-in page when dev login is enabled", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("renders the preview login form alongside GitHub sign-in", async () => {
    const { default: SignInPage } = await import("@/app/auth/signin/page")
    process.env.VERCEL_ENV = "preview"
    process.env.DEV_LOGIN_ENABLED = "true"
    process.env.DEV_LOGIN_SECRET = "shared-preview-secret"

    renderAsyncComponent(
      await SignInPage({
        searchParams: createSignInSearchParams({
          callbackUrl: "/projects",
        }),
      }),
    )

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/shared secret/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /continue with preview login/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /continue with github/i })).toBeInTheDocument()
  })

  it("preserves the callback url through the page load", async () => {
    const { default: SignInPage } = await import("@/app/auth/signin/page")
    process.env.VERCEL_ENV = "preview"
    process.env.DEV_LOGIN_ENABLED = "true"
    process.env.DEV_LOGIN_SECRET = "shared-preview-secret"

    renderAsyncComponent(
      await SignInPage({
        searchParams: createSignInSearchParams({
          callbackUrl: "/projects/42",
        }),
      }),
    )

    expect(screen.getByRole("button", { name: /continue with preview login/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /continue with github/i })).toBeInTheDocument()
  })
})
