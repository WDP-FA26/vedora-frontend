"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"

import { AUTH_KEY } from "@/features/auth/auth-cache"
import { AccessTokenContext } from "@/features/auth/components/auth-provider"
import { toAuthor } from "@/features/auth/lib/to-author"
import type { CurrentUser } from "@/features/auth/types"

/**
 * The signed-in user in Client Components, fetched straight from vedora-api.
 * Needs an `AuthProvider` above it (the `/home` layout has one); without it the
 * user is `null`. Use `accessToken` to call other API endpoints directly.
 */
export function useAuth() {
  const accessToken = use(AccessTokenContext)
  const router = useRouter()

  const { data, error, isLoading, mutate } = useSWR(
    accessToken ? [AUTH_KEY, accessToken] : null,
    async ([url, token]: [string, string]): Promise<CurrentUser> => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      // Expired while the page sat open: re-render the layout so the proxy
      // rotates the pair and the provider passes down a fresh token.
      if (response.status === 401) router.refresh()
      if (!response.ok) throw new Error(`GET /auth/me failed (${response.status})`)
      return response.json()
    },
    { keepPreviousData: true, shouldRetryOnError: false }
  )

  const user = data ?? null
  return {
    user,
    /** `user` in the shape avatar/nav components take, or `null` when signed out. */
    author: user ? toAuthor(user) : null,
    isAuthenticated: user !== null,
    accessToken,
    error,
    isLoading,
    mutate,
  }
}
