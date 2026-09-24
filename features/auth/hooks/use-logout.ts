"use client"

import { useTransition } from "react"

import { logout } from "@/features/auth/actions"

/**
 * Revokes the session on the API, clears the cookies, then goes to `/login`.
 * The SWR cache is cleared on the next sign-in, so the signed-in UI doesn't
 * flash empty while the redirect happens.
 */
export function useLogout() {
  const [pending, startTransition] = useTransition()
  return {
    pending,
    logout: () => startTransition(() => logout()),
  }
}
