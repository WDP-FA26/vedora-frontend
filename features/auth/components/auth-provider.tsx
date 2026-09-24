"use client"

import { createContext } from "react"
import { SWRConfig, unstable_serialize } from "swr"

import { AUTH_KEY } from "@/features/auth/auth-cache"
import type { CurrentUser } from "@/features/auth/types"

export const AccessTokenContext = createContext<string | undefined>(undefined)

/**
 * Hands the server's session to Client Components: the access token (the
 * cookie itself stays httpOnly) and the user, seeded into `useAuth()`'s cache.
 * Layouts don't re-render on client navigation, so a token can outlive its
 * expiry here; `useAuth()` then calls `router.refresh()`, the proxy rotates
 * the pair, and the layout passes the fresh token down.
 */
export function AuthProvider({
  accessToken,
  user,
  children,
}: {
  accessToken: string | undefined
  user: CurrentUser | null
  children: React.ReactNode
}) {
  return (
    <AccessTokenContext value={accessToken}>
      <SWRConfig
        value={{ fallback: { [unstable_serialize([AUTH_KEY, accessToken])]: user } }}
      >
        {children}
      </SWRConfig>
    </AccessTokenContext>
  )
}
