import "server-only"

import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { apiFetch } from "@/features/auth/lib/api"
import { ACCESS_TOKEN_COOKIE } from "@/features/auth/lib/tokens"
import type { CurrentUser } from "@/features/auth/types"

/** Access token for calling vedora-api. The proxy has already rotated it. */
export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value
}

/**
 * The signed-in user, or `null`. Use in Server Components, Server Actions and
 * Route Handlers. Deduplicated per request, so layouts and pages can both call it.
 */
export const getAuth = cache(async (): Promise<CurrentUser | null> => {
  const accessToken = await getAccessToken()
  if (!accessToken) return null

  const response = await apiFetch("/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (response.status === 401 || response.status === 404) return null
  if (!response.ok) throw new Error(`GET /auth/me failed (${response.status})`)
  return response.json()
})

/** Like `getAuth`, but sends signed-out visitors to `/login`. */
export async function requireAuth(returnTo?: string): Promise<CurrentUser> {
  const user = await getAuth()
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login")
  }
  return user
}
