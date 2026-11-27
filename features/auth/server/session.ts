import "server-only"

import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  ACCOUNT_BLOCK_PARAM,
  accountBlockOf,
  type AccountBlock,
} from "@/features/auth/lib/account-block"
import { apiFetch } from "@/features/auth/lib/api"
import { ACCESS_TOKEN_COOKIE } from "@/features/auth/lib/tokens"
import type { CurrentUser } from "@/features/auth/types"

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value
}

const getSession = cache(
  async (): Promise<{ user: CurrentUser | null; block: AccountBlock | null }> => {
    const accessToken = await getAccessToken()
    if (!accessToken) return { user: null, block: null }

    const response = await apiFetch("/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (response.status === 401 || response.status === 404) {
      return { user: null, block: await accountBlockOf(response) }
    }
    if (!response.ok) throw new Error(`GET /auth/me failed (${response.status})`)
    return { user: await response.json(), block: null }
  }
)

export async function getAuth(): Promise<CurrentUser | null> {
  return (await getSession()).user
}

export async function requireAuth(returnTo?: string): Promise<CurrentUser> {
  const { user, block } = await getSession()
  if (!user) {
    const params = new URLSearchParams()
    if (returnTo) params.set("next", returnTo)
    if (block) params.set(ACCOUNT_BLOCK_PARAM, block)
    const query = params.toString()
    redirect(`/auth/session-expired${query ? `?${query}` : ""}`)
  }
  return user
}
