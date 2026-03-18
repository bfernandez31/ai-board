import { getDevLoginFailureRedirect } from "@/app/lib/auth/dev-login"
import { handlers } from "@/lib/auth"
import type { NextRequest } from "next/server"

export const GET = handlers.GET

export async function POST(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const isCredentialsCallback = requestUrl.pathname.endsWith("/api/auth/callback/credentials")
  const clonedRequest = isCredentialsCallback ? request.clone() : null
  const response = await handlers.POST(request)

  if (!isCredentialsCallback) {
    return response
  }

  const location = response.headers.get("location")
  if (!location || !location.includes("error=CredentialsSignin")) {
    return response
  }

  const formData = clonedRequest ? await clonedRequest.formData() : null
  const callbackUrlValue = formData?.get("callbackUrl")
  const callbackUrl =
    typeof callbackUrlValue === "string" && callbackUrlValue.length > 0 ? callbackUrlValue : undefined

  const headers = new Headers(response.headers)
  headers.set("location", getDevLoginFailureRedirect(callbackUrl))

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
