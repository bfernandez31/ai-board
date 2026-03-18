import { timingSafeEqual } from "node:crypto"
import { createOrUpdateDevLoginUser } from "@/app/lib/auth/user-service"
import { z } from "zod"

export const DEV_LOGIN_PROVIDER_ID = "dev-login"

const devLoginCredentialsSchema = z.object({
  email: z.string().trim().email(),
  secret: z.string().min(1),
})

type DevLoginCredentials = Partial<Record<"email" | "secret", unknown>>

type AuthorizedDevLoginUser = {
  id: string
  email: string
  name: string
}

interface AuthorizeDevLoginOptions {
  env?: NodeJS.ProcessEnv
  createUser?: typeof createOrUpdateDevLoginUser
}

function secretsMatch(expectedSecret: string, providedSecret: string): boolean {
  const expectedBuffer = Buffer.from(expectedSecret)
  const providedBuffer = Buffer.from(providedSecret)

  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, providedBuffer)
}

function getDevLoginSecret(env: NodeJS.ProcessEnv): string | null {
  return env.DEV_LOGIN_SECRET?.trim() || null
}

export function isDevLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!getDevLoginSecret(env)) {
    return false
  }

  return env.NODE_ENV !== "production" || env.VERCEL_ENV === "preview"
}

export function getDevLoginErrorMessage(error?: string): string | null {
  return error === "CredentialsSignin" ? "Invalid email or secret." : null
}

export async function authorizeDevLogin(
  credentials: DevLoginCredentials | undefined,
  {
    env = process.env,
    createUser = createOrUpdateDevLoginUser,
  }: AuthorizeDevLoginOptions = {},
): Promise<AuthorizedDevLoginUser | null> {
  if (!isDevLoginEnabled(env)) {
    return null
  }

  const parsedCredentials = devLoginCredentialsSchema.safeParse(credentials)
  if (!parsedCredentials.success) {
    return null
  }

  const configuredSecret = getDevLoginSecret(env)
  const { email, secret } = parsedCredentials.data

  if (!configuredSecret || !secretsMatch(configuredSecret, secret)) {
    return null
  }

  const user = await createUser(email)

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email,
  }
}
