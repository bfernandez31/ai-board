import type { DevLoginCredentialsInput, DevLoginUser } from "@/app/lib/auth/dev-login"

export const enabledDevLoginEnv = {
  VERCEL_ENV: "preview",
  DEV_LOGIN_ENABLED: "true",
  DEV_LOGIN_SECRET: "shared-preview-secret",
} satisfies Partial<NodeJS.ProcessEnv>

export const disabledDevLoginEnv = {
  VERCEL_ENV: "production",
  DEV_LOGIN_ENABLED: "false",
  DEV_LOGIN_SECRET: "",
} satisfies Partial<NodeJS.ProcessEnv>

export function createDevLoginCredentials(
  overrides: Partial<DevLoginCredentialsInput> = {},
): DevLoginCredentialsInput {
  return {
    email: "Preview.User@Example.com ",
    secret: enabledDevLoginEnv.DEV_LOGIN_SECRET!,
    redirectTo: "/projects",
    ...overrides,
  }
}

export function createDevLoginUser(overrides: Partial<DevLoginUser> = {}): DevLoginUser {
  return {
    id: "dev-login-user-id",
    email: "preview.user@example.com",
    name: "preview.user",
    ...overrides,
  }
}
