import { randomUUID, timingSafeEqual } from "node:crypto"
import { prisma } from "@/lib/db/client"
import { z } from "zod"

const DEV_LOGIN_PROVIDER = "credentials"
const DEV_LOGIN_ENV_VALUE = "preview"

export const devLoginCredentialsSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  secret: z.string().trim().min(1),
  redirectTo: z.string().trim().min(1).default("/projects"),
})

export type DevLoginCredentialsInput = z.input<typeof devLoginCredentialsSchema>
export type DevLoginCredentials = z.output<typeof devLoginCredentialsSchema>

export interface DevLoginUser {
  id: string
  email: string
  name: string
}

export interface DevLoginAvailability {
  enabled: boolean
  vercelEnv: string | undefined
  explicitToggle: boolean
  hasSecret: boolean
}

export function getDevLoginAvailability(env: NodeJS.ProcessEnv = process.env): DevLoginAvailability {
  const secret = env.DEV_LOGIN_SECRET?.trim() ?? ""

  return {
    enabled:
      env.VERCEL_ENV === DEV_LOGIN_ENV_VALUE &&
      env.DEV_LOGIN_ENABLED === "true" &&
      secret.length > 0,
    vercelEnv: env.VERCEL_ENV,
    explicitToggle: env.DEV_LOGIN_ENABLED === "true",
    hasSecret: secret.length > 0,
  }
}

export function isDevLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getDevLoginAvailability(env).enabled
}

export function normalizeDevLoginEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function parseDevLoginCredentials(input: DevLoginCredentialsInput): DevLoginCredentials {
  return devLoginCredentialsSchema.parse({
    ...input,
    email: normalizeDevLoginEmail(input.email),
  })
}

export function compareDevLoginSecret(submittedSecret: string, configuredSecret: string): boolean {
  const submitted = Buffer.from(submittedSecret)
  const configured = Buffer.from(configuredSecret)

  if (submitted.length !== configured.length) {
    return false
  }

  return timingSafeEqual(submitted, configured)
}

export function getDevLoginFailureRedirect(callbackUrl?: string): string {
  const params = new URLSearchParams({ error: "dev-login" })

  if (callbackUrl) {
    params.set("callbackUrl", callbackUrl)
  }

  return `/auth/signin?${params.toString()}`
}

function getNameFromEmail(email: string): string {
  const [localPart] = email.split("@")
  return localPart || email
}

export async function authorizeDevLogin(input: DevLoginCredentialsInput): Promise<DevLoginUser | null> {
  if (!isDevLoginEnabled()) {
    return null
  }

  const parsed = devLoginCredentialsSchema.safeParse({
    ...input,
    email: normalizeDevLoginEmail(input.email),
  })

  if (!parsed.success) {
    return null
  }

  const configuredSecret = process.env.DEV_LOGIN_SECRET?.trim() ?? ""
  if (!compareDevLoginSecret(parsed.data.secret, configuredSecret)) {
    return null
  }

  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: parsed.data.email },
    })

    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            emailVerified: existingUser.emailVerified ?? new Date(),
            name: existingUser.name ?? getNameFromEmail(parsed.data.email),
            updatedAt: new Date(),
          },
        })
      : await tx.user.create({
          data: {
            id: randomUUID(),
            email: parsed.data.email,
            name: getNameFromEmail(parsed.data.email),
            emailVerified: new Date(),
            updatedAt: new Date(),
          },
        })

    await tx.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: DEV_LOGIN_PROVIDER,
          providerAccountId: parsed.data.email,
        },
      },
      update: {
        userId: user.id,
        type: DEV_LOGIN_PROVIDER,
      },
      create: {
        id: randomUUID(),
        userId: user.id,
        type: DEV_LOGIN_PROVIDER,
        provider: DEV_LOGIN_PROVIDER,
        providerAccountId: parsed.data.email,
      },
    })

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? getNameFromEmail(parsed.data.email),
    }
  })
}
