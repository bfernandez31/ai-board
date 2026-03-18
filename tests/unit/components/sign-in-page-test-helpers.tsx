import { render } from "@testing-library/react"
import type { ReactElement } from "react"

export function createSignInSearchParams(overrides: Record<string, string | undefined> = {}) {
  return Promise.resolve({
    callbackUrl: "/projects",
    error: undefined,
    ...overrides,
  })
}

export function renderAsyncComponent(component: ReactElement) {
  return render(component)
}
