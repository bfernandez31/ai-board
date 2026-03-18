import { getDevLoginFailureRedirect } from '@/app/lib/auth/dev-login';
import { handlers } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export const GET = handlers.GET;

function isCredentialsCallbackRequest(request: NextRequest): boolean {
  const requestUrl = new URL(request.url);
  return requestUrl.pathname.endsWith('/api/auth/callback/credentials');
}

function getCallbackUrlValue(
  value: FormDataEntryValue | null
): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  return value;
}

export async function POST(request: NextRequest): Promise<Response> {
  const isCredentialsCallback = isCredentialsCallbackRequest(request);
  const requestClone = isCredentialsCallback ? request.clone() : null;
  const response = await handlers.POST(request);

  if (!isCredentialsCallback) {
    return response;
  }

  const location = response.headers.get('location');
  if (!location || !location.includes('error=CredentialsSignin')) {
    return response;
  }

  const formData = requestClone ? await requestClone.formData() : null;
  const callbackUrl = getCallbackUrlValue(formData?.get('callbackUrl') ?? null);

  const headers = new Headers(response.headers);
  headers.set('location', getDevLoginFailureRedirect(callbackUrl));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
