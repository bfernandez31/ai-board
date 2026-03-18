import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { createOrUpdateDevLoginUser } from '@/app/lib/auth/user-service';

export const DEV_LOGIN_PROVIDER_ID = 'dev-login';

const devLoginCredentialsSchema = z.object({
  email: z.string().trim().email(),
  secret: z.string().min(1),
});

interface AuthorizeDevLoginOptions {
  env?: NodeJS.ProcessEnv;
  createUser?: typeof createOrUpdateDevLoginUser;
}

function secretsMatch(expectedSecret: string, providedSecret: string): boolean {
  const expectedBuffer = Buffer.from(expectedSecret);
  const providedBuffer = Buffer.from(providedSecret);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function isDevLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const secret = env.DEV_LOGIN_SECRET?.trim();
  if (!secret) {
    return false;
  }

  return env.NODE_ENV !== 'production' || env.VERCEL_ENV === 'preview';
}

export function getDevLoginErrorMessage(error?: string): string | null {
  if (error === 'CredentialsSignin') {
    return 'Invalid email or secret.';
  }

  return null;
}

export async function authorizeDevLogin(
  credentials: Partial<Record<'email' | 'secret', unknown>> | undefined,
  {
    env = process.env,
    createUser = createOrUpdateDevLoginUser,
  }: AuthorizeDevLoginOptions = {}
) {
  if (!isDevLoginEnabled(env)) {
    return null;
  }

  const parsedCredentials = devLoginCredentialsSchema.safeParse(credentials);
  if (!parsedCredentials.success) {
    return null;
  }

  const configuredSecret = env.DEV_LOGIN_SECRET?.trim();
  if (!configuredSecret || !secretsMatch(configuredSecret, parsedCredentials.data.secret)) {
    return null;
  }

  const user = await createUser(parsedCredentials.data.email);

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email,
  };
}
