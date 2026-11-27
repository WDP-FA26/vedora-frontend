"use client"

import { useTransition } from "react"

import { logout } from "@/features/auth/actions"
import { useDisconnectPostDrafts } from "@/features/post-drafts/provider"

export function useLogout() {
  const [pending, startTransition] = useTransition()
  const disconnectDrafts = useDisconnectPostDrafts()
  return {
    pending,
    logout: () => { disconnectDrafts?.(); startTransition(() => logout()) },
  }
}
