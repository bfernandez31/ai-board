import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import SignInPage from "@/app/auth/signin/page"

const mockIsDevLoginEnabled = vi.fn()

vi.mock('@/lib/auth', () => ({
  signIn: vi.fn(),
}))

vi.mock('@/app/lib/auth/dev-login', () => ({
  getDevLoginErrorMessage: (error?: string) =>
    error === 'CredentialsSignin' ? 'Invalid email or secret.' : null,
  isDevLoginEnabled: (...args: unknown[]) => mockIsDevLoginEnabled(...args),
}))

async function renderSignInPage(searchParams: { callbackUrl?: string; error?: string } = {}) {
  render(
    await SignInPage({
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe('SignInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows only GitHub OAuth when dev login is disabled', async () => {
    mockIsDevLoginEnabled.mockReturnValue(false)

    await renderSignInPage()

    expect(screen.getByRole('button', { name: /continue with github/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /dev login/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/shared secret/i)).not.toBeInTheDocument()
  })

  it('shows the dev login form when enabled', async () => {
    mockIsDevLoginEnabled.mockReturnValue(true)

    await renderSignInPage()

    expect(screen.getByRole('heading', { name: /dev login/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/shared secret/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in with dev login/i })).toBeInTheDocument()
  })

  it('shows an inline error for failed credentials sign-in attempts', async () => {
    mockIsDevLoginEnabled.mockReturnValue(true)

    await renderSignInPage({ error: 'CredentialsSignin' })

    expect(screen.getByText(/invalid email or secret/i)).toBeInTheDocument()
  })
})
