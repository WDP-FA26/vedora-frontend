"use client"

import { createContext } from "react"
import { SWRConfig, unstable_serialize } from "swr"

import { AUTH_KEY } from "@/features/auth/auth-cache"
import type { CurrentUser } from "@/features/auth/types"
import { PostDraftSession } from "@/features/post-drafts/provider"

export const AccessTokenContext = createContext<string | undefined>(undefined)

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
        <PostDraftSession userId={user?.id} token={accessToken} />
        {children}
      </SWRConfig>
    </AccessTokenContext>
  )
}
