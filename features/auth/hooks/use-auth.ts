"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"

import { AUTH_KEY } from "@/features/auth/auth-cache"
import { AccessTokenContext } from "@/features/auth/components/auth-provider"
import { toAuthor } from "@/features/auth/lib/to-author"
import type { CurrentUser } from "@/features/auth/types"

const AUTH_REVALIDATE_MS = 60_000

export function useAuth() {
  const accessToken = use(AccessTokenContext)
  const router = useRouter()

  const { data, error, isLoading, mutate } = useSWR(
    accessToken ? [AUTH_KEY, accessToken] : null,
    async ([url, token]: [string, string]): Promise<CurrentUser> => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status === 401) router.refresh()
      if (!response.ok) throw new Error(`GET /auth/me failed (${response.status})`)
      return response.json()
    },
    {
      keepPreviousData: true,
      shouldRetryOnError: false,
      dedupingInterval: AUTH_REVALIDATE_MS,
    }
  )

  const user = data ?? null
  return {
    user,
    author: user ? toAuthor(user) : null,
    isAuthenticated: user !== null,
    accessToken,
    error,
    isLoading,
    mutate,
  }
}
